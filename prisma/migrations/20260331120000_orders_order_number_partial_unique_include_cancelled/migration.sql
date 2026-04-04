-- 柜号唯一：仅对「非完成留档且非已取消」订单生效；archived / cancelled 可与同号并存（与归档一致）
DROP INDEX IF EXISTS "public"."orders_order_number_non_archived_key";

CREATE UNIQUE INDEX "orders_order_number_non_archived_key" ON "public"."orders" ("order_number")
WHERE ("status" IS DISTINCT FROM 'archived' AND "status" IS DISTINCT FROM 'cancelled');
