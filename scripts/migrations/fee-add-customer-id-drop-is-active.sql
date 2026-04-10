-- 费用表：新增 customer_id（可空，关联 customers）；删除 is_active
-- 与 prisma/migrations/20260331140000_fee_customer_id_remove_is_active 一致，便于在非 migrate 环境手工执行

ALTER TABLE public.fee ADD COLUMN IF NOT EXISTS customer_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fee_customer_id_fkey'
  ) THEN
    ALTER TABLE public.fee
      ADD CONSTRAINT fee_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fee_customer_id ON public.fee(customer_id);

ALTER TABLE public.fee DROP COLUMN IF EXISTS is_active;
