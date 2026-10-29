export type TransactionStatus = 'PAID' | 'PENDING' | 'OVERDUE'

/** Status devolvido pelo backend: PENDING (a vencer), LATE (vencida) ou PAID. */
export type LedgerStatus = 'PENDING' | 'LATE' | 'PAID'

export interface Bucket {
  count: number
  total: number
}

export interface ReceivablesSummary {
  to_receive: Bucket
  overdue: Bucket
  paid: Bucket
}

export interface PayablesSummary {
  to_pay: Bucket
  overdue: Bucket
  paid: Bucket
}

export interface ReceivableRow {
  id: string
  leaseId: string
  dueDate: string
  paidDate: string | null
  competency: string | null
  description: string | null
  type: 'RENT' | 'DEPOSIT' | 'EXPENSE' | 'OTHER'
  status: LedgerStatus
  /** Valor bruto da cobrança. */
  amount: number
  lateFee: number
  interest: number
  /** Bruto + multa + juros (valor atualizado quando vencida). */
  updatedTotal: number
  netAmount: number | null
  chargeMethod: string | null
}

export interface PayableRow {
  id: string
  unitId: string
  dueDate: string
  paidDate: string | null
  description: string
  category: 'ELECTRICITY' | 'WATER' | 'CONDO' | 'TAX' | 'MAINTENANCE' | 'OTHER'
  status: LedgerStatus
  amount: number
  paidAmount: number | null
}

export interface Receivable {
  id: string
  dueDate: string
  payer: string
  property: string
  amount: number
  paymentMethod: 'BOLETO' | 'PIX' | 'CREDIT_CARD'
  status: TransactionStatus
  type: 'RENT' | 'SALE_INSTALLMENT' | 'CONDO_FEE'
}

export interface Payable {
  id: string
  dueDate: string
  supplier: string
  category: 'PROPERTY_TAX' | 'CONDO_FEE' | 'MAINTENANCE' | 'TAX' | 'OTHER'
  amount: number
  relatedProperty: string
  status: TransactionStatus
}

export interface BankRecord {
  id: string
  date: string
  description: string
  amount: number
}

export interface Transfer {
  id: string
  owner: string
  properties: string
  grossReceipt: number
  adminFeePerc: number
  adminFeeAmount: number
  discounts: number
  netValue: number
  status: 'PENDING' | 'PROCESSED' | 'TRANSFERRED'
}

export interface Commission {
  id: string
  broker: string
  type: 'SALE' | 'LEASE'
  baseValue: number
  percentage: number
  taxRetentionISS: number
  taxRetentionIRRF: number
  amountToPay: number
  property: string
}

export interface DashboardMetrics {
  expectedRevenue: number
  realizedRevenue: number
  defaultRate: number
  totalRentValue: number
  totalToTransfer: number
}