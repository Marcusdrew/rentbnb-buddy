ALTER TABLE public.tenants ADD COLUMN due_day integer NOT NULL DEFAULT 1 CHECK (due_day BETWEEN 1 AND 31);
ALTER TABLE public.expenses ADD COLUMN expense_date date NOT NULL DEFAULT CURRENT_DATE;
UPDATE public.expenses SET expense_date = created_at::date;
CREATE TABLE public.rental_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 amount_usd numeric NOT NULL DEFAULT 0 CHECK (amount_usd >= 0),
 received_date date NOT NULL DEFAULT CURRENT_DATE,
 note text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_payments TO authenticated;
GRANT ALL ON public.rental_payments TO service_role;
ALTER TABLE public.rental_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads payments" ON public.rental_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner creates payments" ON public.rental_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.user_id = auth.uid()));
CREATE POLICY "Owner updates payments" ON public.rental_payments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.user_id = auth.uid()));
CREATE POLICY "Owner deletes payments" ON public.rental_payments FOR DELETE TO authenticated USING (auth.uid() = user_id);
INSERT INTO public.rental_payments (user_id, tenant_id, amount_usd, received_date) SELECT user_id, id, received_usd, created_at::date FROM public.tenants WHERE received_usd > 0;
COMMENT ON COLUMN public.tenants.received_usd IS 'DEPRECATED: replaced by dated rental_payments';
CREATE INDEX rental_payments_owner_date ON public.rental_payments(user_id, received_date);