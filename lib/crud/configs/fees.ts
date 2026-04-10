/**
 * 费用主数据实体配置（第一版）
 */

import { EntityConfig } from '../types'

export const feeConfig: EntityConfig = {
  name: 'fee',
  displayName: '费用',
  pluralName: '费用',

  apiPath: '/api/finance/fees',
  detailPath: '/dashboard/finance/fees',
  idField: 'id',

  schemaName: 'fee',

  fields: {
    id: {
      key: 'id',
      label: 'ID',
      type: 'text',
      hidden: true,
    },
    fee_code: {
      key: 'fee_code',
      label: '费用编码',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '如 STORAGE',
    },
    fee_name: {
      key: 'fee_name',
      label: '费用名称',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '如 仓储费',
    },
    unit: {
      key: 'unit',
      label: '单位',
      type: 'text',
      placeholder: '板/箱/票等',
    },
    unit_price: {
      key: 'unit_price',
      label: '单价',
      type: 'currency',
      sortable: true,
    },
    currency: {
      key: 'currency',
      label: '币种',
      type: 'text',
    },
    scope_type: {
      key: 'scope_type',
      label: '归属范围',
      type: 'badge',
      sortable: true,
      options: [
        { label: '所有客户', value: 'all' },
        { label: '指定客户', value: 'customers' },
      ],
    },
    customer_id: {
      key: 'customer_id',
      label: '客户名称',
      type: 'relation',
      relation: {
        model: 'customers',
        displayField: 'name',
        valueField: 'id',
      },
    },
    container_type: {
      key: 'container_type',
      label: '柜型',
      type: 'text',
      sortable: true,
      placeholder: '如 20GP/40DH，空表示不限',
    },
    description: {
      key: 'description',
      label: '说明',
      type: 'textarea',
    },
    created_at: {
      key: 'created_at',
      label: '创建时间',
      type: 'date',
      sortable: true,
      hidden: true,
    },
    updated_at: {
      key: 'updated_at',
      label: '更新时间',
      type: 'date',
      sortable: true,
      hidden: true,
    },
  },

  list: {
    defaultSort: 'container_type',
    defaultOrder: 'asc',
    columns: [
      'fee_code',
      'fee_name',
      'unit',
      'unit_price',
      'currency',
      'scope_type',
      'customer_id',
      'container_type',
      'description',
    ],
    searchFields: ['fee_code', 'fee_name'],
    pageSize: 100,
    batchOperations: {
      enabled: true,
      edit: { enabled: true },
      delete: { enabled: true },
    },
    inlineEdit: { enabled: true },
  },

  formFields: [
    'fee_code',
    'fee_name',
    'unit',
    'unit_price',
    'currency',
    'scope_type',
    'customer_id',
    'container_type',
    'description',
  ],

  permissions: {
    list: ['admin', 'oms_manager', 'employee', 'user', 'oms_operator'],
    create: ['admin', 'oms_manager', 'oms_operator'], // 操作部门可以创建费用
    update: ['admin', 'oms_manager', 'oms_operator'], // 操作部门可以编辑费用
    delete: ['admin', 'oms_manager', 'oms_operator'], // 操作部门可以删除费用
  },

  prisma: {
    model: 'fee',
    include: {
      customers: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  },
}
