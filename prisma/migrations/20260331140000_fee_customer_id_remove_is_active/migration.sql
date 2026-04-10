-- 费用表：绑定可选客户（用于默认价目 / 每客户价目）；移除启用标志
ALTER TABLE "public"."fee" ADD COLUMN "customer_id" BIGINT;

ALTER TABLE "public"."fee" ADD CONSTRAINT "fee_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX "idx_fee_customer_id" ON "public"."fee"("customer_id");

ALTER TABLE "public"."fee" DROP COLUMN "is_active";
