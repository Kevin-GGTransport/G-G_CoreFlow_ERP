-- 费用：记录由哪条模板行复制而来，便于默认表多行同编码+柜型时仍按行复制
ALTER TABLE "public"."fee" ADD COLUMN "cloned_from_fee_id" BIGINT;

ALTER TABLE "public"."fee" ADD CONSTRAINT "fee_cloned_from_fee_id_fkey" FOREIGN KEY ("cloned_from_fee_id") REFERENCES "public"."fee"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX "idx_fee_cloned_from_fee_id" ON "public"."fee"("cloned_from_fee_id");
