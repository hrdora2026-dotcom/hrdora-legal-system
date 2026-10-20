
-- ===== Roles & permissions =====
CREATE TYPE public.app_role AS ENUM ('admin','staff');
CREATE TYPE public.app_permission AS ENUM ('record_payments','approve_adjustments','reverse_payments','manage_masters','import_records');
CREATE TYPE public.opinion_status AS ENUM ('received','in_progress','ready','submitted','on_hold');
CREATE TYPE public.bill_status AS ENUM ('draft','finalized');
CREATE TYPE public.charge_category AS ENUM ('legal_opinion','ec','single_search','document','other','custom');
CREATE TYPE public.adjustment_type AS ENUM ('discount','write_off','settlement');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission public.app_permission NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission)
);
GRANT SELECT, INSERT, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.is_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id
                 WHERE r.user_id=_user_id AND p.active)
$$;

CREATE OR REPLACE FUNCTION public.has_perm(_user_id uuid, _perm public.app_permission)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_member(_user_id) AND (public.has_role(_user_id,'admin')
    OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id=_user_id AND permission=_perm))
$$;

CREATE POLICY "members read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_member(auth.uid()));
CREATE POLICY "admin or self update profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR id = auth.uid());
CREATE POLICY "read roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_member(auth.uid()));
CREATE POLICY "admin insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND user_id <> auth.uid());
CREATE POLICY "read perms" ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_member(auth.uid()));
CREATE POLICY "admin insert perms" ON public.user_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete perms" ON public.user_permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Prevent non-admins toggling their own "active" flag
CREATE OR REPLACE FUNCTION public.guard_profile_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.active IS DISTINCT FROM OLD.active AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Only Admin can activate or deactivate users';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_profile BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- New user: profile; first user ever becomes Admin; others wait for Admin approval
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.email);
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Masters =====
CREATE TABLE public.banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_code text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX banks_name_uq ON public.banks (lower(name));

CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES public.banks(id),
  name text NOT NULL,
  city text,
  contact text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX branches_name_uq ON public.branches (bank_id, lower(name));

-- ===== Opinions =====
CREATE SEQUENCE public.opinion_no_seq;
CREATE TABLE public.opinions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opinion_no text NOT NULL UNIQUE,
  borrower_name text NOT NULL,
  bank_id uuid NOT NULL REFERENCES public.banks(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  docs_received_date date,
  docs_description text,
  assigned_to uuid REFERENCES public.profiles(id),
  remarks text,
  status public.opinion_status NOT NULL DEFAULT 'received',
  submission_date date,
  submission_ref text,
  import_batch_id uuid,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX opinions_borrower_idx ON public.opinions (lower(borrower_name));
CREATE INDEX opinions_bank_idx ON public.opinions (bank_id);
CREATE INDEX opinions_branch_idx ON public.opinions (branch_id);
CREATE INDEX opinions_status_idx ON public.opinions (status);

CREATE OR REPLACE FUNCTION public.opinions_before() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' AND (NEW.opinion_no IS NULL OR btrim(NEW.opinion_no)='') THEN
    NEW.opinion_no := 'OP-' || to_char(now() AT TIME ZONE 'Asia/Kolkata','YYYY') || '-' || lpad(nextval('public.opinion_no_seq')::text, 5, '0');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id=NEW.branch_id AND bank_id=NEW.bank_id) THEN
    RAISE EXCEPTION 'Branch does not belong to the selected bank';
  END IF;
  IF NEW.status='submitted' AND NEW.submission_date IS NULL THEN
    NEW.submission_date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_opinions_before BEFORE INSERT OR UPDATE ON public.opinions FOR EACH ROW EXECUTE FUNCTION public.opinions_before();

CREATE TABLE public.opinion_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opinion_id uuid NOT NULL REFERENCES public.opinions(id) ON DELETE CASCADE,
  title text NOT NULL,
  received_date date,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX opinion_documents_op_idx ON public.opinion_documents(opinion_id);

-- ===== Bills =====
CREATE SEQUENCE public.bill_no_seq;
CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_no text NOT NULL UNIQUE,
  opinion_id uuid NOT NULL REFERENCES public.opinions(id),
  bill_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  status public.bill_status NOT NULL DEFAULT 'draft',
  total numeric(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  remarks text,
  import_batch_id uuid,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bills_opinion_idx ON public.bills(opinion_id);

CREATE OR REPLACE FUNCTION public.bills_before() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' AND (NEW.bill_no IS NULL OR btrim(NEW.bill_no)='') THEN
    NEW.bill_no := 'BL-' || to_char(now() AT TIME ZONE 'Asia/Kolkata','YYYY') || '-' || lpad(nextval('public.bill_no_seq')::text, 5, '0');
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_bills_before BEFORE INSERT OR UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.bills_before();

CREATE TABLE public.bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  category public.charge_category NOT NULL,
  description text,
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  rate numeric(14,2) NOT NULL CHECK (rate >= 0),
  amount numeric(14,2) GENERATED ALWAYS AS (round(quantity * rate, 2)) STORED,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bill_items_bill_idx ON public.bill_items(bill_id);

-- ===== Payments ledger =====
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL,
  method text,
  reference text,
  remarks text,
  is_historical boolean NOT NULL DEFAULT false,
  idempotency_key text NOT NULL UNIQUE,
  recorded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_bill_idx ON public.payments(bill_id);
CREATE INDEX payments_date_idx ON public.payments(payment_date);

CREATE TABLE public.payment_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  reversed_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id),
  type public.adjustment_type NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  adjustment_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  approved_by uuid DEFAULT auth.uid(),
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX adjustments_bill_idx ON public.adjustments(bill_id);

CREATE TABLE public.followup_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  note text NOT NULL,
  next_followup_date date,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX followup_bill_idx ON public.followup_notes(bill_id);

-- ===== Imports =====
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  sheet_name text,
  total_rows int NOT NULL DEFAULT 0,
  accepted_rows int NOT NULL DEFAULT 0,
  rejected_rows int NOT NULL DEFAULT 0,
  mapping jsonb,
  file_fingerprint text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number int NOT NULL,
  status text NOT NULL CHECK (status IN ('accepted','rejected')),
  messages text[],
  raw jsonb,
  opinion_id uuid REFERENCES public.opinions(id),
  bill_id uuid REFERENCES public.bills(id)
);
CREATE INDEX import_rows_batch_idx ON public.import_rows(batch_id);

-- ===== Audit =====
CREATE TABLE public.audit_logs (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_record_idx ON public.audit_logs(record_id);
CREATE INDEX audit_time_idx ON public.audit_logs(changed_at DESC);

CREATE OR REPLACE FUNCTION public.audit_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs(table_name, record_id, action, old_data, new_data, changed_by)
  VALUES (TG_TABLE_NAME,
          COALESCE((CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END)),
          TG_OP,
          CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
          auth.uid());
  RETURN COALESCE(NEW, OLD);
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['banks','branches','opinions','opinion_documents','bills','bill_items','payments','payment_reversals','adjustments','followup_notes','user_permissions','user_roles'] LOOP
    EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t);
  END LOOP;
END $$;

-- ===== Bill total maintenance & finance guards =====
CREATE OR REPLACE FUNCTION public.bill_received(_bill uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(p.amount),0) FROM public.payments p
  WHERE p.bill_id=_bill AND NOT EXISTS (SELECT 1 FROM public.payment_reversals r WHERE r.payment_id=p.id)
$$;
CREATE OR REPLACE FUNCTION public.bill_adjusted(_bill uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(amount),0) FROM public.adjustments WHERE bill_id=_bill AND reversed_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public.recalc_bill_total() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid := COALESCE(NEW.bill_id, OLD.bill_id); t numeric;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO t FROM public.bill_items WHERE bill_id=b;
  IF t < public.bill_received(b) + public.bill_adjusted(b) THEN
    RAISE EXCEPTION 'Bill total (%) cannot be less than amount already received plus approved adjustments', t;
  END IF;
  UPDATE public.bills SET total=t WHERE id=b;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_bill_items_total AFTER INSERT OR UPDATE OR DELETE ON public.bill_items FOR EACH ROW EXECUTE FUNCTION public.recalc_bill_total();

-- ===== Summary view =====
CREATE OR REPLACE VIEW public.bill_summary WITH (security_invoker = true) AS
SELECT b.id AS bill_id, b.bill_no, b.bill_date, b.status AS bill_status, b.total,
  b.opinion_id, o.opinion_no, o.borrower_name, o.bank_id, bk.name AS bank_name,
  o.branch_id, br.name AS branch_name, o.status AS opinion_status, o.submission_date,
  COALESCE(p.received,0)::numeric(14,2) AS received,
  COALESCE(p.historical,0)::numeric(14,2) AS historical_received,
  COALESCE(a.adjusted,0)::numeric(14,2) AS adjusted,
  (b.total - COALESCE(p.received,0) - COALESCE(a.adjusted,0))::numeric(14,2) AS outstanding,
  p.last_payment_date,
  CASE
    WHEN b.total = 0 THEN 'unpaid'
    WHEN b.total - COALESCE(p.received,0) - COALESCE(a.adjusted,0) <= 0 AND COALESCE(a.adjusted,0) > 0 THEN 'settled'
    WHEN b.total - COALESCE(p.received,0) <= 0 THEN 'paid'
    WHEN COALESCE(p.received,0) > 0 OR COALESCE(a.adjusted,0) > 0 THEN 'partial'
    ELSE 'unpaid' END AS payment_status,
  b.created_at
FROM public.bills b
JOIN public.opinions o ON o.id=b.opinion_id
JOIN public.banks bk ON bk.id=o.bank_id
JOIN public.branches br ON br.id=o.branch_id
LEFT JOIN LATERAL (
  SELECT SUM(x.amount) AS received, SUM(x.amount) FILTER (WHERE x.is_historical) AS historical, MAX(x.payment_date) AS last_payment_date
  FROM public.payments x WHERE x.bill_id=b.id AND NOT EXISTS (SELECT 1 FROM public.payment_reversals r WHERE r.payment_id=x.id)
) p ON true
LEFT JOIN LATERAL (
  SELECT SUM(y.amount) AS adjusted FROM public.adjustments y WHERE y.bill_id=b.id AND y.reversed_at IS NULL
) a ON true;
GRANT SELECT ON public.bill_summary TO authenticated;

-- ===== Grants + RLS for business tables =====
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['banks','branches','opinions','opinion_documents','bills','bill_items','payments','payment_reversals','adjustments','followup_notes','import_batches','import_rows','audit_logs'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "members read" ON public.%I FOR SELECT TO authenticated USING (public.is_member(auth.uid()))', t);
  END LOOP;
END $$;
GRANT USAGE ON SEQUENCE public.audit_logs_id_seq TO service_role;

GRANT INSERT, UPDATE ON public.banks, public.branches TO authenticated;
CREATE POLICY "masters insert" ON public.banks FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(),'manage_masters'));
CREATE POLICY "masters update" ON public.banks FOR UPDATE TO authenticated USING (public.has_perm(auth.uid(),'manage_masters')) WITH CHECK (public.has_perm(auth.uid(),'manage_masters'));
CREATE POLICY "masters insert" ON public.branches FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(),'manage_masters'));
CREATE POLICY "masters update" ON public.branches FOR UPDATE TO authenticated USING (public.has_perm(auth.uid(),'manage_masters')) WITH CHECK (public.has_perm(auth.uid(),'manage_masters'));

GRANT INSERT, UPDATE ON public.opinions, public.bills TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.opinion_documents, public.bill_items TO authenticated;
GRANT INSERT ON public.followup_notes TO authenticated;
CREATE POLICY "members insert" ON public.opinions FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "members update" ON public.opinions FOR UPDATE TO authenticated USING (public.is_member(auth.uid())) WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "members insert" ON public.opinion_documents FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "members update" ON public.opinion_documents FOR UPDATE TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "members delete" ON public.opinion_documents FOR DELETE TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "members insert" ON public.bills FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "members update" ON public.bills FOR UPDATE TO authenticated USING (public.is_member(auth.uid())) WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "members insert" ON public.followup_notes FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()) AND created_by = auth.uid());

-- Bill items: staff may edit draft bills; finalized bills only by Admin
CREATE OR REPLACE FUNCTION public.can_edit_bill(_bill uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_member(auth.uid()) AND (
    public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.bills WHERE id=_bill AND status='draft'))
$$;
CREATE POLICY "edit items" ON public.bill_items FOR INSERT TO authenticated WITH CHECK (public.can_edit_bill(bill_id));
CREATE POLICY "update items" ON public.bill_items FOR UPDATE TO authenticated USING (public.can_edit_bill(bill_id)) WITH CHECK (public.can_edit_bill(bill_id));
CREATE POLICY "delete items" ON public.bill_items FOR DELETE TO authenticated USING (public.can_edit_bill(bill_id));

-- Only Admin may un-finalize a bill
CREATE OR REPLACE FUNCTION public.guard_bill_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status='finalized' AND NEW.status='draft' AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Only Admin can reopen a finalized bill';
  END IF;
  IF NEW.total IS DISTINCT FROM OLD.total AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Bill total is calculated from its charge items';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_bill BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.guard_bill_status();

-- Payments / reversals / adjustments: NO direct writes. Only via audited functions below.

-- ===== Financial RPCs =====
CREATE OR REPLACE FUNCTION public.record_payment(
  _bill_id uuid, _amount numeric, _payment_date date, _kind text,
  _method text, _reference text, _remarks text, _idempotency_key text, _settlement_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bills; outstanding numeric; pid uuid; existing uuid;
BEGIN
  IF NOT public.has_perm(auth.uid(),'record_payments') THEN RAISE EXCEPTION 'You are not authorised to record payments'; END IF;
  SELECT id INTO existing FROM public.payments WHERE idempotency_key=_idempotency_key;
  IF existing IS NOT NULL THEN RETURN jsonb_build_object('payment_id', existing, 'duplicate', true); END IF;
  SELECT * INTO b FROM public.bills WHERE id=_bill_id FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF b.status <> 'finalized' THEN RAISE EXCEPTION 'Finalize the bill before recording payments'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  IF _payment_date IS NULL OR _payment_date > (now() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION 'Payment date cannot be in the future'; END IF;
  outstanding := b.total - public.bill_received(b.id) - public.bill_adjusted(b.id);
  IF _amount > outstanding THEN RAISE EXCEPTION 'Amount (%) exceeds outstanding balance (%)', _amount, outstanding; END IF;
  IF _kind = 'full' AND _amount <> outstanding THEN RAISE EXCEPTION 'Full payment must equal the outstanding balance (%)', outstanding; END IF;
  IF _kind = 'settlement' THEN
    IF NOT public.has_perm(auth.uid(),'approve_adjustments') THEN RAISE EXCEPTION 'You are not authorised to approve settlements'; END IF;
    IF _settlement_reason IS NULL OR length(btrim(_settlement_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required for final settlement'; END IF;
  END IF;
  INSERT INTO public.payments(bill_id, amount, payment_date, method, reference, remarks, idempotency_key)
  VALUES (b.id, _amount, _payment_date, NULLIF(btrim(_method),''), NULLIF(btrim(_reference),''), NULLIF(btrim(_remarks),''), _idempotency_key)
  RETURNING id INTO pid;
  IF _kind = 'settlement' AND outstanding - _amount > 0 THEN
    INSERT INTO public.adjustments(bill_id, type, amount, reason, adjustment_date, idempotency_key)
    VALUES (b.id, 'settlement', outstanding - _amount, _settlement_reason, _payment_date, _idempotency_key || ':adj');
  END IF;
  RETURN jsonb_build_object('payment_id', pid, 'duplicate', false);
END $$;

CREATE OR REPLACE FUNCTION public.reverse_payment(_payment_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_perm(auth.uid(),'reverse_payments') THEN RAISE EXCEPTION 'You are not authorised to reverse payments'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF EXISTS (SELECT 1 FROM public.payment_reversals WHERE payment_id=_payment_id) THEN RAISE EXCEPTION 'Payment already reversed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payments WHERE id=_payment_id) THEN RAISE EXCEPTION 'Payment not found'; END IF;
  INSERT INTO public.payment_reversals(payment_id, reason) VALUES (_payment_id, btrim(_reason));
END $$;

CREATE OR REPLACE FUNCTION public.approve_adjustment(_bill_id uuid, _type public.adjustment_type, _amount numeric, _reason text, _date date, _idempotency_key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bills; outstanding numeric; aid uuid;
BEGIN
  IF NOT public.has_perm(auth.uid(),'approve_adjustments') THEN RAISE EXCEPTION 'You are not authorised to approve adjustments'; END IF;
  SELECT id INTO aid FROM public.adjustments WHERE idempotency_key=_idempotency_key;
  IF aid IS NOT NULL THEN RETURN aid; END IF;
  SELECT * INTO b FROM public.bills WHERE id=_bill_id FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF b.status <> 'finalized' THEN RAISE EXCEPTION 'Finalize the bill first'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  outstanding := b.total - public.bill_received(b.id) - public.bill_adjusted(b.id);
  IF _amount <= 0 OR _amount > outstanding THEN RAISE EXCEPTION 'Adjustment must be between 0 and the outstanding balance (%)', outstanding; END IF;
  INSERT INTO public.adjustments(bill_id, type, amount, reason, adjustment_date, idempotency_key)
  VALUES (b.id, _type, _amount, btrim(_reason), COALESCE(_date,(now() AT TIME ZONE 'Asia/Kolkata')::date), _idempotency_key)
  RETURNING id INTO aid;
  RETURN aid;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_adjustment(_adjustment_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_perm(auth.uid(),'approve_adjustments') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  UPDATE public.adjustments SET reversed_at=now(), reversed_by=auth.uid(), reversal_reason=btrim(_reason)
  WHERE id=_adjustment_id AND reversed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Adjustment not found or already reversed'; END IF;
END $$;

-- ===== Excel import commit (one transaction) =====
-- rows: [{row_number, status, messages[], raw, borrower_name, bank, branch, opinion_no, docs_received_date,
--         submission_date, remarks, charges:{legal_opinion,ec,single_search,document,other}, received, payment_date}]
CREATE OR REPLACE FUNCTION public.commit_import(_file_name text, _sheet text, _fingerprint text, _mapping jsonb, _rows jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE batch uuid; r jsonb; bank_id uuid; branch_id uuid; op_id uuid; bill_id uuid; k text; v numeric;
  acc int := 0; rej int := 0; total_items numeric; rec numeric;
BEGIN
  IF NOT public.has_perm(auth.uid(),'import_records') THEN RAISE EXCEPTION 'You are not authorised to import records'; END IF;
  INSERT INTO public.import_batches(file_name, sheet_name, file_fingerprint, mapping, total_rows)
  VALUES (_file_name, _sheet, _fingerprint, _mapping, jsonb_array_length(_rows)) RETURNING id INTO batch;
  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    IF r->>'status' <> 'accepted' THEN
      INSERT INTO public.import_rows(batch_id,row_number,status,messages,raw)
      VALUES (batch,(r->>'row_number')::int,'rejected',ARRAY(SELECT jsonb_array_elements_text(r->'messages')),r->'raw');
      rej := rej + 1; CONTINUE;
    END IF;
    BEGIN
      SELECT id INTO bank_id FROM public.banks WHERE lower(name)=lower(btrim(r->>'bank'));
      IF bank_id IS NULL THEN INSERT INTO public.banks(name) VALUES (btrim(r->>'bank')) RETURNING id INTO bank_id; END IF;
      SELECT id INTO branch_id FROM public.branches b WHERE b.bank_id=bank_id AND lower(b.name)=lower(btrim(r->>'branch'));
      IF branch_id IS NULL THEN INSERT INTO public.branches(bank_id,name) VALUES (bank_id, btrim(r->>'branch')) RETURNING id INTO branch_id; END IF;
      INSERT INTO public.opinions(opinion_no, borrower_name, bank_id, branch_id, docs_received_date, submission_date, status, remarks, import_batch_id)
      VALUES (NULLIF(btrim(r->>'opinion_no'),''), btrim(r->>'borrower_name'), bank_id, branch_id,
              NULLIF(r->>'docs_received_date','')::date, NULLIF(r->>'submission_date','')::date,
              CASE WHEN NULLIF(r->>'submission_date','') IS NOT NULL THEN 'submitted'::public.opinion_status ELSE 'received'::public.opinion_status END,
              NULLIF(r->>'remarks',''), batch)
      RETURNING id INTO op_id;
      bill_id := NULL;
      SELECT COALESCE(SUM((value)::numeric),0) INTO total_items FROM jsonb_each_text(COALESCE(r->'charges','{}'::jsonb)) WHERE value <> '';
      IF total_items > 0 THEN
        INSERT INTO public.bills(opinion_id, status, bill_date, import_batch_id, remarks)
        VALUES (op_id, 'draft', COALESCE(NULLIF(r->>'submission_date','')::date, NULLIF(r->>'docs_received_date','')::date, (now() AT TIME ZONE 'Asia/Kolkata')::date), batch, 'Imported from ' || _file_name)
        RETURNING id INTO bill_id;
        FOR k, v IN SELECT key, value::numeric FROM jsonb_each_text(r->'charges') WHERE value <> '' AND value::numeric > 0 LOOP
          INSERT INTO public.bill_items(bill_id, category, description, quantity, rate)
          VALUES (bill_id, k::public.charge_category, CASE WHEN k='other' AND r->>'total_balancing'='true' THEN 'Imported total (no item breakdown)' ELSE NULL END, 1, v);
        END LOOP;
        UPDATE public.bills SET status='finalized' WHERE id=bill_id;
        rec := COALESCE(NULLIF(r->>'received','')::numeric, 0);
        IF rec > 0 THEN
          INSERT INTO public.payments(bill_id, amount, payment_date, remarks, is_historical, idempotency_key)
          VALUES (bill_id, rec, COALESCE(NULLIF(r->>'payment_date','')::date, NULLIF(r->>'submission_date','')::date, NULLIF(r->>'docs_received_date','')::date, (now() AT TIME ZONE 'Asia/Kolkata')::date),
                  CASE WHEN NULLIF(r->>'payment_date','') IS NULL THEN 'HISTORICAL COLLECTION (imported total; payment date not in source)' ELSE 'HISTORICAL COLLECTION (imported)' END,
                  true, 'import:' || batch || ':' || (r->>'row_number'));
        END IF;
      END IF;
      INSERT INTO public.import_rows(batch_id,row_number,status,messages,raw,opinion_id,bill_id)
      VALUES (batch,(r->>'row_number')::int,'accepted',ARRAY(SELECT jsonb_array_elements_text(COALESCE(r->'messages','[]'::jsonb))),r->'raw',op_id,bill_id);
      acc := acc + 1;
    EXCEPTION WHEN others THEN
      INSERT INTO public.import_rows(batch_id,row_number,status,messages,raw)
      VALUES (batch,(r->>'row_number')::int,'rejected',ARRAY[SQLERRM],r->'raw');
      rej := rej + 1;
    END;
  END LOOP;
  UPDATE public.import_batches SET accepted_rows=acc, rejected_rows=rej WHERE id=batch;
  RETURN batch;
END $$;

REVOKE EXECUTE ON FUNCTION public.record_payment(uuid,numeric,date,text,text,text,text,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reverse_payment(uuid,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.approve_adjustment(uuid,public.adjustment_type,numeric,text,date,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reverse_adjustment(uuid,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.commit_import(text,text,text,jsonb,jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid,numeric,date,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_payment(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_adjustment(uuid,public.adjustment_type,numeric,text,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_adjustment(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_import(text,text,text,jsonb,jsonb) TO authenticated;

-- Realtime for multi-device sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.opinions, public.bills, public.bill_items, public.payments, public.payment_reversals, public.adjustments, public.followup_notes, public.banks, public.branches;
