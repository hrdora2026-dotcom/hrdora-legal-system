
BEGIN;

DROP FUNCTION public.create_bill(
  uuid, date, text, jsonb, boolean, uuid, boolean
);

CREATE FUNCTION public.create_bill(
  _opinion_id uuid,
  _bill_date date,
  _remarks text,
  _items jsonb,
  _finalize boolean,
  _key uuid,
  _allow_additional boolean,
  _submission_status text,
  _submission_date date,
  _submission_ref text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  bid uuid;
  existing_opinion_id uuid;
  it jsonb;
  qty numeric;
  rate numeric;
BEGIN
  IF NOT public.is_member(auth.uid()) THEN
    RAISE EXCEPTION 'Office authorization required';
  END IF;

  IF _key IS NULL OR _bill_date IS NULL THEN
    RAISE EXCEPTION 'Bill date and submission key are required';
  END IF;

  IF _finalize AND (
    _submission_status IS NULL
    OR _submission_status NOT IN ('ready', 'submitted')
  ) THEN
    RAISE EXCEPTION 'Select a valid submission status';
  END IF;

  IF _finalize
     AND _submission_status = 'submitted'
     AND _submission_date IS NULL THEN
    RAISE EXCEPTION 'Submission date is required';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_key::text, 0)
  );

  SELECT id, opinion_id
  INTO bid, existing_opinion_id
  FROM public.bills
  WHERE creation_key = _key
    AND created_by = auth.uid();

  IF bid IS NOT NULL THEN
    IF existing_opinion_id IS DISTINCT FROM _opinion_id THEN
      RAISE EXCEPTION 'This bill key belongs to a different opinion';
    END IF;

    IF _finalize THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.bill_items
        WHERE bill_id = bid
      ) THEN
        RAISE EXCEPTION 'Add at least one charge item before finalizing';
      END IF;

      UPDATE public.bills
      SET status = 'finalized'
      WHERE id = bid
        AND status = 'draft';

      UPDATE public.opinions
      SET
        status = CASE
          WHEN _submission_status = 'submitted'
            THEN 'submitted'::public.opinion_status
          ELSE 'ready'::public.opinion_status
        END,
        submission_date = CASE
          WHEN _submission_status = 'submitted'
            THEN _submission_date
          ELSE NULL
        END,
        submission_ref = CASE
          WHEN _submission_status = 'submitted'
            THEN NULLIF(btrim(_submission_ref), '')
          ELSE NULL
        END
      WHERE id = _opinion_id;
    END IF;

    RETURN bid;
  END IF;

  PERFORM id
  FROM public.opinions
  WHERE id = _opinion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Select a valid opinion';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bills
    WHERE opinion_id = _opinion_id
  ) AND NOT _allow_additional THEN
    RAISE EXCEPTION
      'A bill already exists. Confirm an additional bill';
  END IF;

  IF jsonb_typeof(_items) <> 'array'
     OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'At least one charge item is required';
  END IF;

  INSERT INTO public.bills (
    opinion_id,
    bill_no,
    bill_date,
    remarks,
    creation_key,
    created_by
  )
  VALUES (
    _opinion_id,
    '',
    _bill_date,
    NULLIF(btrim(_remarks), ''),
    _key,
    auth.uid()
  )
  RETURNING id INTO bid;

  FOR it IN
    SELECT * FROM jsonb_array_elements(_items)
  LOOP
    qty := (it->>'quantity')::numeric;
    rate := (it->>'rate')::numeric;

    IF qty IS NULL
       OR rate IS NULL
       OR qty <= 0
       OR rate < 0
       OR qty <> round(qty, 2)
       OR rate <> round(rate, 2) THEN
      RAISE EXCEPTION
        'Quantity must be positive and rate nonnegative, with at most two decimal places';
    END IF;

    INSERT INTO public.bill_items (
      bill_id,
      category,
      description,
      quantity,
      rate,
      created_by
    )
    VALUES (
      bid,
      (it->>'category')::public.charge_category,
      NULLIF(btrim(it->>'description'), ''),
      qty,
      rate,
      auth.uid()
    );
  END LOOP;

  IF _finalize THEN
    UPDATE public.bills
    SET status = 'finalized'
    WHERE id = bid;

    UPDATE public.opinions
    SET
      status = CASE
        WHEN _submission_status = 'submitted'
          THEN 'submitted'::public.opinion_status
        ELSE 'ready'::public.opinion_status
      END,
      submission_date = CASE
        WHEN _submission_status = 'submitted'
          THEN _submission_date
        ELSE NULL
      END,
      submission_ref = CASE
        WHEN _submission_status = 'submitted'
          THEN NULLIF(btrim(_submission_ref), '')
        ELSE NULL
      END
    WHERE id = _opinion_id;
  END IF;

  RETURN bid;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_bill(
  uuid, date, text, jsonb, boolean, uuid,
  boolean, text, date, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_bill(
  uuid, date, text, jsonb, boolean, uuid,
  boolean, text, date, text
) TO authenticated;

COMMIT;
