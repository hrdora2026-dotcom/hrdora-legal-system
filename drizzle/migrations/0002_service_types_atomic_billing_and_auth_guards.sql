ALTER TABLE public.opinions ADD COLUMN service_type text;
ALTER TABLE public.opinions ADD CONSTRAINT opinions_service_type_check CHECK (service_type IN ('Legal Opinion','Vetting','Supplementary Opinion'));
CREATE FUNCTION public.require_service_type() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.service_type IS NULL AND NEW.import_batch_id IS NULL AND (TG_OP='INSERT' OR OLD.service_type IS NOT NULL) THEN RAISE EXCEPTION 'Select a service type'; END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_opinion_service_type BEFORE INSERT OR UPDATE ON public.opinions FOR EACH ROW EXECUTE FUNCTION public.require_service_type();
DO $$ DECLARE definition text; BEGIN SELECT pg_get_viewdef('public.bill_summary',true) INTO definition; definition := regexp_replace(definition, 'b.created_at', 'b.created_at, o.service_type, b.remarks'); EXECUTE 'CREATE OR REPLACE VIEW public.bill_summary WITH (security_invoker=true) AS ' || definition; END $$;
ALTER TABLE public.bills ADD COLUMN creation_key uuid;
CREATE UNIQUE INDEX bills_creation_key_uq ON public.bills(creation_key) WHERE creation_key IS NOT NULL;
CREATE FUNCTION public.create_bill(_opinion_id uuid,_bill_date date,_remarks text,_items jsonb,_finalize boolean,_key uuid,_allow_additional boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bid uuid; it jsonb; qty numeric; rate numeric;
BEGIN
 IF NOT public.is_member(auth.uid()) THEN RAISE EXCEPTION 'Office authorization required'; END IF;
 IF _key IS NULL OR _bill_date IS NULL THEN RAISE EXCEPTION 'Bill date and submission key are required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_key::text,0));
 SELECT id INTO bid FROM public.bills WHERE creation_key=_key AND created_by=auth.uid(); IF bid IS NOT NULL THEN RETURN bid; END IF;
 PERFORM id FROM public.opinions WHERE id=_opinion_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Select a valid opinion'; END IF;
 IF EXISTS(SELECT 1 FROM public.bills WHERE opinion_id=_opinion_id) AND NOT _allow_additional THEN RAISE EXCEPTION 'A bill already exists. Confirm an additional bill'; END IF;
 IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items)=0 THEN RAISE EXCEPTION 'At least one charge item is required'; END IF;
 INSERT INTO public.bills(opinion_id,bill_no,bill_date,remarks,creation_key,created_by) VALUES(_opinion_id,'',_bill_date,NULLIF(btrim(_remarks),''),_key,auth.uid()) RETURNING id INTO bid;
 FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
  qty := (it->>'quantity')::numeric; rate := (it->>'rate')::numeric;
  IF qty IS NULL OR rate IS NULL OR qty<=0 OR rate<0 OR qty<>round(qty,2) OR rate<>round(rate,2) THEN RAISE EXCEPTION 'Quantity must be positive and rate nonnegative, with at most two decimal places'; END IF;
  INSERT INTO public.bill_items(bill_id,category,description,quantity,rate,created_by) VALUES(bid,(it->>'category')::public.charge_category,NULLIF(btrim(it->>'description'),''),qty,rate,auth.uid());
 END LOOP;
 IF _finalize THEN UPDATE public.bills SET status='finalized' WHERE id=bid; END IF;
 RETURN bid;
END $$;
REVOKE ALL ON FUNCTION public.create_bill(uuid,date,text,jsonb,boolean,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_bill(uuid,date,text,jsonb,boolean,uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_bill_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF OLD.status='finalized' AND NOT public.has_role(auth.uid(),'admin') AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.opinion_id IS DISTINCT FROM OLD.opinion_id OR NEW.bill_date IS DISTINCT FROM OLD.bill_date OR NEW.remarks IS DISTINCT FROM OLD.remarks) THEN RAISE EXCEPTION 'Only Admin can correct a finalized bill'; END IF;
 IF OLD.status='finalized' AND NEW.status='draft' AND (public.bill_received(OLD.id)>0 OR public.bill_adjusted(OLD.id)>0) THEN RAISE EXCEPTION 'Bills with collections or adjustments cannot be reopened'; END IF;
 IF NEW.bill_no IS DISTINCT FROM OLD.bill_no OR NEW.opinion_id IS DISTINCT FROM OLD.opinion_id THEN RAISE EXCEPTION 'Bill number and opinion link are permanent'; END IF;
 IF NEW.status='finalized' AND OLD.status='draft' AND NOT EXISTS(SELECT 1 FROM public.bill_items WHERE bill_id=OLD.id) THEN RAISE EXCEPTION 'Add at least one charge item before finalizing'; END IF;
 IF NEW.total IS DISTINCT FROM OLD.total AND pg_trigger_depth()<2 THEN RAISE EXCEPTION 'Bill total is calculated from its charge items'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.create_bank_with_branches(_name text,_short_code text,_branches jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE bid uuid; br jsonb; BEGIN
 IF NOT public.has_perm(auth.uid(),'manage_masters') THEN RAISE EXCEPTION 'Master management permission required'; END IF;
 IF NULLIF(btrim(_name),'') IS NULL THEN RAISE EXCEPTION 'Bank name is required'; END IF;
 INSERT INTO public.banks(name,short_code) VALUES(btrim(_name),NULLIF(btrim(_short_code),'')) RETURNING id INTO bid;
 FOR br IN SELECT * FROM jsonb_array_elements(_branches) LOOP
 IF NULLIF(btrim(br->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Branch name is required'; END IF;
 INSERT INTO public.branches(bank_id,name,city,contact) VALUES(bid,btrim(br->>'name'),NULLIF(btrim(br->>'city'),''),NULLIF(btrim(br->>'contact'),''));
 END LOOP; RETURN bid;
END $$;
REVOKE ALL ON FUNCTION public.create_bank_with_branches(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_bank_with_branches(text,text,jsonb) TO authenticated;
CREATE TABLE public.admin_bootstrap(id boolean PRIMARY KEY DEFAULT true CHECK(id),claimed boolean NOT NULL DEFAULT false);
GRANT ALL ON public.admin_bootstrap TO service_role;
ALTER TABLE public.admin_bootstrap ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admin_bootstrap(id,claimed) SELECT true,EXISTS(SELECT 1 FROM public.profiles);
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE taken boolean; BEGIN
 IF TG_OP='INSERT' THEN INSERT INTO public.profiles(id,full_name,email) VALUES(NEW.id,COALESCE(NEW.raw_user_meta_data->>'full_name',NEW.raw_user_meta_data->>'name',split_part(NEW.email,'@',1)),NEW.email); END IF;
 IF NEW.email_confirmed_at IS NOT NULL THEN
 SELECT claimed INTO taken FROM public.admin_bootstrap WHERE id=true FOR UPDATE;
 IF NOT taken THEN INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'admin'); UPDATE public.admin_bootstrap SET claimed=true WHERE id=true; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_confirmed AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) EXECUTE FUNCTION public.handle_new_user();
CREATE OR REPLACE FUNCTION public.is_member(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id JOIN auth.users u ON u.id=p.id WHERE r.user_id=_user_id AND p.active AND u.email_confirmed_at IS NOT NULL) $$;
CREATE FUNCTION public.protect_last_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF OLD.role='admin' THEN PERFORM pg_advisory_xact_lock(771902); IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin' AND id<>OLD.id) THEN RAISE EXCEPTION 'The last Admin cannot be removed'; END IF; END IF; RETURN OLD; END $$;
CREATE TRIGGER trg_last_admin BEFORE DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin();