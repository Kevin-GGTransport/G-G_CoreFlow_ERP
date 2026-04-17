-- 预约主表增加「启用」开关，默认 true，历史数据视为启用
ALTER TABLE "oms"."delivery_appointments"
ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN DEFAULT true;

UPDATE "oms"."delivery_appointments"
SET "enabled" = true
WHERE "enabled" IS NULL;
