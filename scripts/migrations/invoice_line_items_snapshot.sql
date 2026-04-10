-- 账单明细：费用改为可选快照，避免与费用主表强绑定；可选关联订单明细
ALTER TABLE public.invoice_line_items
  ALTER COLUMN fee_id DROP NOT NULL;

ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS fee_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS fee_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS unit VARCHAR(50),
  ADD COLUMN IF NOT EXISTS line_notes TEXT,
  ADD COLUMN IF NOT EXISTS order_detail_id BIGINT;

-- 历史数据：从费用表回填快照（便于脱离 fee_id 展示）
UPDATE public.invoice_line_items ili
SET
  fee_code = COALESCE(ili.fee_code, f.fee_code),
  fee_name = COALESCE(ili.fee_name, f.fee_name),
  unit = COALESCE(ili.unit, f.unit)
FROM public.fee f
WHERE ili.fee_id IS NOT NULL AND f.id = ili.fee_id
  AND (ili.fee_code IS NULL OR ili.fee_name IS NULL);

ALTER TABLE public.invoice_line_items
  ADD CONSTRAINT invoice_line_items_order_detail_id_fkey
  FOREIGN KEY (order_detail_id) REFERENCES public.order_detail(id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_order_detail_id
  ON public.invoice_line_items(order_detail_id);
