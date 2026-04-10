-- fee.cloned_from_fee_id：按客户复制默认费用时指向源模板行
ALTER TABLE public.fee ADD COLUMN IF NOT EXISTS cloned_from_fee_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_cloned_from_fee_id_fkey') THEN
    ALTER TABLE public.fee
      ADD CONSTRAINT fee_cloned_from_fee_id_fkey
      FOREIGN KEY (cloned_from_fee_id) REFERENCES public.fee(id) ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fee_cloned_from_fee_id ON public.fee(cloned_from_fee_id);
