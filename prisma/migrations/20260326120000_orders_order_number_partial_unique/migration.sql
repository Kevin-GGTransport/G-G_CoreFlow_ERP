-- 柜号：仅「未完成留档」时全局唯一；status = archived 时允许与同号历史行并存
-- Prisma 旧版可能以 CONSTRAINT 或 UNIQUE INDEX 形式建 orders_order_number_key，两种都尝试删除
ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_order_number_key";
DROP INDEX IF EXISTS "public"."orders_order_number_key";
-- 若库中已由手工或其它环境建过同名 partial index，先删掉再建，避免 P3018
DROP INDEX IF EXISTS "public"."orders_order_number_non_archived_key";

CREATE UNIQUE INDEX "orders_order_number_non_archived_key" ON "public"."orders" ("order_number") WHERE ("status" IS DISTINCT FROM 'archived');
