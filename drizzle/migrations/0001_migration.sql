
CREATE OR REPLACE FUNCTION public.commit_import(_file_name text, _sheet text, _fingerprint text, _mapping jsonb, _rows jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_batch uuid; r jsonb; v_bank uuid; v_branch uuid; v_op uuid; v_bill uuid; k text; v numeric;
  acc int := 0; rej int := 0; total_items numeric; rec numeric;
BEGIN
  IF NOT public.has_perm(auth.uid(),'import_records') THEN RAISE EXCEPTION 'You are not authorised to import records'; END IF;
  INSERT INTO public.import_batches(file_name, sheet_name, file_fingerprint, mapping, total_rows)
  VALUES (_file_name, _sheet, _fingerprint, _mapping, jsonb_array_length(_rows)) RETURNING id INTO v_batch;
  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    IF r->>'status' <> 'accepted' THEN
      INSERT INTO public.import_rows(batch_id,row_number,status,messages,raw)
      VALUES (v_batch,(r->>'row_number')::int,'rejected',ARRAY(SELECT jsonb_array_elements_text(r->'messages')),r->'raw');
      rej := rej + 1; CONTINUE;
    END IF;
    BEGIN
      v_bank := NULL; v_branch := NULL; v_bill := NULL;
      SELECT bk.id INTO v_bank FROM public.banks bk WHERE lower(bk.name)=lower(btrim(r->>'bank'));
      IF v_bank IS NULL THEN INSERT INTO public.banks(name) VALUES (btrim(r->>'bank')) RETURNING id INTO v_bank; END IF;
      SELECT br.id INTO v_branch FROM public.branches br WHERE br.bank_id=v_bank AND lower(br.name)=lower(btrim(r->>'branch'));
      IF v_branch IS NULL THEN INSERT INTO public.branches(bank_id,name) VALUES (v_bank, btrim(r->>'branch')) RETURNING id INTO v_branch; END IF;
      INSERT INTO public.opinions(opinion_no, borrower_name, bank_id, branch_id, docs_received_date, submission_date, status, remarks, import_batch_id)
      VALUES (NULLIF(btrim(r->>'opinion_no'),''), btrim(r->>'borrower_name'), v_bank, v_branch,
              NULLIF(r->>'docs_received_date','')::date, NULLIF(r->>'submission_date','')::date,
              CASE WHEN NULLIF(r->>'submission_date','') IS NOT NULL THEN 'submitted'::public.opinion_status ELSE 'received'::public.opinion_status END,
              NULLIF(r->>'remarks',''), v_batch)
      RETURNING id INTO v_op;
      SELECT COALESCE(SUM((e.value)::numeric),0) INTO total_items FROM jsonb_each_text(COALESCE(r->'charges','{}'::jsonb)) e WHERE e.value <> '';
      IF total_items > 0 THEN
        INSERT INTO public.bills(opinion_id, status, bill_date, import_batch_id, remarks)
        VALUES (v_op, 'draft', COALESCE(NULLIF(r->>'submission_date','')::date, NULLIF(r->>'docs_received_date','')::date, (now() AT TIME ZONE 'Asia/Kolkata')::date), v_batch, 'Imported from ' || _file_name)
        RETURNING id INTO v_bill;
        FOR k, v IN SELECT e.key, e.value::numeric FROM jsonb_each_text(r->'charges') e WHERE e.value <> '' AND e.value::numeric > 0 LOOP
          INSERT INTO public.bill_items(bill_id, category, description, quantity, rate)
          VALUES (v_bill, k::public.charge_category, CASE WHEN k='other' AND r->>'total_balancing'='true' THEN 'Imported total (no item breakdown in source)' ELSE NULL END, 1, v);
        END LOOP;
        UPDATE public.bills SET status='finalized' WHERE id=v_bill;
        rec := COALESCE(NULLIF(r->>'received','')::numeric, 0);
        IF rec > 0 THEN
          INSERT INTO public.payments(bill_id, amount, payment_date, remarks, is_historical, idempotency_key)
          VALUES (v_bill, rec, COALESCE(NULLIF(r->>'payment_date','')::date, NULLIF(r->>'submission_date','')::date, NULLIF(r->>'docs_received_date','')::date, (now() AT TIME ZONE 'Asia/Kolkata')::date),
                  CASE WHEN NULLIF(r->>'payment_date','') IS NULL THEN 'HISTORICAL COLLECTION (imported total; payment date not in source)' ELSE 'HISTORICAL COLLECTION (imported)' END,
                  true, 'import:' || v_batch || ':' || (r->>'row_number'));
        END IF;
      END IF;
      INSERT INTO public.import_rows(batch_id,row_number,status,messages,raw,opinion_id,bill_id)
      VALUES (v_batch,(r->>'row_number')::int,'accepted',ARRAY(SELECT jsonb_array_elements_text(COALESCE(r->'messages','[]'::jsonb))),r->'raw',v_op,v_bill);
      acc := acc + 1;
    EXCEPTION WHEN others THEN
      INSERT INTO public.import_rows(batch_id,row_number,status,messages,raw)
      VALUES (v_batch,(r->>'row_number')::int,'rejected',ARRAY[SQLERRM],r->'raw');
      rej := rej + 1;
    END;
  END LOOP;
  UPDATE public.import_batches SET accepted_rows=acc, rejected_rows=rej WHERE id=v_batch;
  RETURN v_batch;
END $$;
