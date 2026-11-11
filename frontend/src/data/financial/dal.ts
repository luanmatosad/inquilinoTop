type TransactionStatus = 'PAID' | 'PENDING' | 'OVERDUE'

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
  /** Data do lançamento em AAAA-MM-DD. */
  date: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  /** Pagamento conciliado com este lançamento; null quando não conciliado. */
  paymentId: string | null
}

export interface Transfer {
  id: string
  propertyId: string
  propertyName: string
  ownerName: string
  /** Competência do repasse em AAAA-MM. */
  period: string
  grossAmount: number
  adminFeePercent: number
  adminFeeAmount: number
  discounts: number
  netAmount: number
  status: 'PENDING' | 'PROCESSED' | 'TRANSFERRED'
  transferredAt: string | null
}

export interface DashboardMetrics {
  expectedRevenue: number
  realizedRevenue: number
  defaultRate: number
  totalRentValue: number
  totalToTransfer: number
}