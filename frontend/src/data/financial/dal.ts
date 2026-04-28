export type TransactionStatus = 'PAID' | 'PENDING' | 'OVERDUE'

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