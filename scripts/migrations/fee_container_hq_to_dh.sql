-- 一次性：费用主数据柜型与订单对齐（40HQ/45HQ → 40DH/45DH），便于与订单 container_type 匹配。
-- 在部署后于目标库执行：psql $DATABASE_URL -f scripts/migrations/fee_container_hq_to_dh.sql

UPDATE public.fee
SET container_type = REPLACE(container_type, 'HQ', 'DH')
WHERE container_type IS NOT NULL
  AND container_type LIKE '%HQ%';
