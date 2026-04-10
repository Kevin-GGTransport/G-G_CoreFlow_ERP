-- 批量：将「All-in」类编码且费用名称为 SMF1n 的行统一改为 WAL-SMF1N（所有客户默认行 + 客户专属行等全部命中）。
-- fee_code 匹配规则与代码中 normCode 一致：忽略大小写、空格、下划线、连字符 → 归一为 allin
-- 执行前可先运行下方 SELECT 看影响行数。

-- SELECT id, fee_code, fee_name, scope_type, customer_id
-- FROM public.fee
-- WHERE lower(regexp_replace(trim(fee_code), '[\s_-]+', '', 'g')) = 'allin'
--   AND lower(trim(fee_name)) = 'smf1n';

UPDATE public.fee
SET
  fee_name = 'WAL-SMF1N',
  updated_at = NOW()
WHERE lower(regexp_replace(trim(fee_code), '[\s_-]+', '', 'g')) = 'allin'
  AND lower(trim(fee_name)) = 'smf1n';
