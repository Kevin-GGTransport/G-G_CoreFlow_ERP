-- 实际板数：null=未填（计算按预计板数），0=明确为零
ALTER TABLE "wms"."inventory_lots" ALTER COLUMN "pallet_count" DROP NOT NULL;
ALTER TABLE "wms"."inventory_lots" ALTER COLUMN "pallet_count" DROP DEFAULT;
