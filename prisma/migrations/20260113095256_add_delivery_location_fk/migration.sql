-- Migration: Add foreign key constraint for order_detail.delivery_location_id
-- This migration converts delivery_location from String to BigInt (delivery_location_id)
-- and adds a foreign key constraint to locations.location_id
-- 注意：勿在此文件内使用 BEGIN/COMMIT，Prisma Migrate 已对整段 SQL 包事务。

-- Step 1: Add new column delivery_location_id
ALTER TABLE public.order_detail 
ADD COLUMN IF NOT EXISTS delivery_location_id BIGINT;

-- Step 2–3: 仅当仍存在旧列 delivery_location 时做数据迁移并删除（库若已部分迁移过则跳过）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_detail'
      AND column_name = 'delivery_location'
  ) THEN
    UPDATE public.order_detail od
    SET delivery_location_id = CASE
      WHEN od.delivery_location ~ '^[0-9]+$' THEN CAST(od.delivery_location AS BIGINT)
      WHEN od.delivery_location IS NOT NULL THEN
        (SELECT location_id FROM public.locations WHERE location_code = od.delivery_location LIMIT 1)
      ELSE NULL
    END
    WHERE od.delivery_location IS NOT NULL;

    ALTER TABLE public.order_detail DROP COLUMN IF EXISTS delivery_location;
  END IF;
END $$;

-- Step 4: Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'order_detail_delivery_location_id_fk'
  ) THEN
    ALTER TABLE public.order_detail
    ADD CONSTRAINT order_detail_delivery_location_id_fk
    FOREIGN KEY (delivery_location_id)
    REFERENCES public.locations(location_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 5: Update index (drop old index, add new index)
DROP INDEX IF EXISTS public.idx_order_detail_delivery_location;
CREATE INDEX IF NOT EXISTS idx_order_detail_delivery_location_id ON public.order_detail(delivery_location_id);
