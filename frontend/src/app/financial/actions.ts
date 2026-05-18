'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { goFetch } from '@/lib/go/client'
export type {
  DashboardMetrics,
  Receivable,
  Commission,
  BankRecord,
  TransactionStatus,
} from '@/data/financial/dal'

import type {
  DashboardMetrics,
  Receivable,
  Commission,
  BankRecord,
} from '@/data/financial/dal'

interface GoPayment {
  id: string
  lease_id: string
  due_date: string
  paid_date?: string
  gross_amount: number
  status: 'PENDING' | 'PAID' | 'LATE'
  type: 'RENT' | 'DEPOSIT' | 'EXPENSE' | 'OTHER'
  charge_method?: string
  description?: string
  competency?: string
}

function mapPaymentStatus(status: string): Receivable['status'] {
  if (status === 'PAID') return 'PAID'
  if (status === 'LATE') return 'OVERDUE'
  return 'PENDING'
}

function mapPaymentType(type: string): Receivable['type'] {
  if (type === 'RENT') return 'RENT'
  return 'CONDO_FEE'
}

function mapChargeMethod(method?: string): Receivable['paymentMethod'] {
  if (method === 'PIX') return 'PIX'
  if (method === 'BOLETO') return 'BOLETO'
  return 'PIX'
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  let payments: GoPayment[] = []
  try {
    payments = await goFetch<GoPayment[]>('/api/v1/payments') || []
  } catch (e) {
    console.error(e)
  }

  const realizedRevenue = payments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + p.gross_amount, 0)

  const expectedRevenue = payments
    .filter(p => p.status === 'PAID' || p.status === 'PENDING')
    .reduce((sum, p) => sum + p.gross_amount, 0)

  const late = payments.filter(p => p.status === 'LATE').length
  const defaultRate = payments.length > 0 ? (late / payments.length) * 100 : 0

  const totalRentValue = payments
    .filter(p => p.type === 'RENT')
    .reduce((sum, p) => sum + p.gross_amount, 0)

  const totalToTransfer = payments
    .filter(p => p.status === 'PAID' && p.type === 'RENT')
    .reduce((sum, p) => sum + p.gross_amount, 0)

  return {
    expectedRevenue,
    realizedRevenue,
    defaultRate: parseFloat(defaultRate.toFixed(1)),
    totalRentValue,
    totalToTransfer,
  }
}

export async function getReceivables(): Promise<Receivable[]> {
  let payments: GoPayment[] = []
  try {
    payments = await goFetch<GoPayment[]>('/api/v1/payments') || []
  } catch (e) {
    console.error(e)
  }

  return payments
    .filter(p => p.type === 'RENT' || p.type === 'OTHER')
    .map(p => ({
      id: p.id,
      dueDate: p.due_date,
      payer: p.description ?? `Lease ${p.lease_id.slice(0, 8)}`,
      property: p.competency ?? '—',
      amount: p.gross_amount,
      paymentMethod: mapChargeMethod(p.charge_method),
      status: mapPaymentStatus(p.status),
      type: mapPaymentType(p.type),
    }))
}

export async function getCommissions(): Promise<Commission[]> {
  return []
}

export async function getBankRecords(): Promise<BankRecord[]> {
  return []
}

// ─── Phase 4: Reconciliation ─────────────────────────────────────────────────

export type ReconStatus = 'MATCHED' | 'SUGGESTED' | 'UNMATCHED' | 'MANUAL'

export interface BankAccount {
  id: string
  bank: string
  label: string
  agency: string
  number: string
  brandColor: string
  balance: number
  isCaucao?: boolean
}

export interface ReconLine {
  id: string
  accountId: string
  date: string
  desc: string
  counterparty: string
  amount: number
  status: ReconStatus
  confidence: number
  match: null | {
    kind: 'receivable' | 'payable'
    id: string
    title: string
    sub: string
  }
}

export interface ReconciliationResponse {
  account: BankAccount
  period: { from: string; to: string }
  lines: ReconLine[]
  counts: {
    total: number
    matched: number
    suggested: number
    unmatched: number
    manual: number
  }
}

export interface MatchCandidate {
  id: string
  kind: 'receivable' | 'payable'
  title: string
  sub: string
  amount: number
}

const BANK_ACCOUNTS_SEED: BankAccount[] = [
  { id: 'acc_01', bank: 'Itaú', label: 'Conta principal', agency: '0581', number: '12345-6', brandColor: '#ff7200', balance: 184320.50 },
  { id: 'acc_02', bank: 'Bradesco', label: 'Conta caução', agency: '2304', number: '98765-4', brandColor: '#cc092f', balance: 42180.00, isCaucao: true },
  { id: 'acc_03', bank: 'Inter PJ', label: 'Conta PJ', agency: '0001', number: '54321-0', brandColor: '#ff7a00', balance: 8760.00 },
]

const RECON_LINES_SEED: ReconLine[] = [
  {
    id: 'rl_01', accountId: 'acc_01', date: '2026-05-05',
    desc: 'PIX RECEBIDO JOAO MARCOS SILVA', counterparty: 'João M. Silva',
    amount: 3250, status: 'SUGGESTED', confidence: 0.98,
    match: { kind: 'receivable', id: 'recv_01', title: 'Aluguel — Apto 101 Solar Ipanema', sub: 'Maio · vence 05/05' },
  },
  {
    id: 'rl_02', accountId: 'acc_01', date: '2026-05-05',
    desc: 'PIX RECEBIDO MARIA FERNANDA COSTA', counterparty: 'Maria F. Costa',
    amount: 2890, status: 'MATCHED', confidence: 1,
    match: { kind: 'receivable', id: 'recv_02', title: 'Aluguel — Casa 3 Vila Madalena', sub: 'Maio · vence 05/05' },
  },
  {
    id: 'rl_03', accountId: 'acc_01', date: '2026-05-06',
    desc: 'PIX RECEBIDO CARLOS AUGUSTO PEREIRA', counterparty: 'Carlos A. Pereira',
    amount: 4100, status: 'SUGGESTED', confidence: 0.94,
    match: { kind: 'receivable', id: 'recv_03', title: 'Aluguel — Sala 502 Faria Lima', sub: 'Maio · vence 07/05' },
  },
  {
    id: 'rl_04', accountId: 'acc_01', date: '2026-05-07',
    desc: 'DEBITO CONDOMINIO RES ALFA', counterparty: 'Condomínio Res. Alfa',
    amount: -650, status: 'SUGGESTED', confidence: 0.91,
    match: { kind: 'payable', id: 'pay_01', title: 'Condomínio — Ap. 304 Res. Alfa', sub: 'Maio · vence 20/05' },
  },
  {
    id: 'rl_05', accountId: 'acc_01', date: '2026-05-08',
    desc: 'DEBITO PREFEITURA MUNICIPAL IPTU', counterparty: 'Prefeitura Municipal',
    amount: -1200, status: 'UNMATCHED', confidence: 0,
    match: null,
  },
  {
    id: 'rl_06', accountId: 'acc_01', date: '2026-05-08',
    desc: 'PIX RECEBIDO LUCIA SANTOS', counterparty: 'Lúcia Santos',
    amount: 2640, status: 'MATCHED', confidence: 1,
    match: { kind: 'receivable', id: 'recv_04', title: 'Aluguel — Apto 22 Cobertura Sul', sub: 'Maio · vence 08/05' },
  },
  {
    id: 'rl_07', accountId: 'acc_01', date: '2026-05-09',
    desc: 'TED RECEBIDO EMPRESA XYZ LTDA', counterparty: 'Empresa XYZ Ltda.',
    amount: 5400, status: 'UNMATCHED', confidence: 0,
    match: null,
  },
  {
    id: 'rl_08', accountId: 'acc_01', date: '2026-05-10',
    desc: 'DEBITO CLEANPRO SERVICOS', counterparty: 'CleanPro Serviços',
    amount: -320, status: 'MATCHED', confidence: 1,
    match: { kind: 'payable', id: 'pay_02', title: 'Limpeza — Ap. 201 Ed. Beira Mar', sub: 'Abril · pago 10/05' },
  },
  {
    id: 'rl_09', accountId: 'acc_01', date: '2026-05-11',
    desc: 'PIX RECEBIDO ROBERTO ALVES JUNIOR', counterparty: 'Roberto A. Junior',
    amount: 1850, status: 'SUGGESTED', confidence: 0.76,
    match: { kind: 'receivable', id: 'recv_05', title: 'Aluguel — Quitinete 4B Centro', sub: 'Maio · vence 10/05' },
  },
  {
    id: 'rl_10', accountId: 'acc_01', date: '2026-05-12',
    desc: 'DEBITO DEXTER DEDETIZACOES', counterparty: 'Dexter Dedetizações',
    amount: -250, status: 'MANUAL', confidence: 0,
    match: { kind: 'payable', id: 'pay_03', title: 'Dedetização — Casa 1 Jd. América', sub: 'Maio · vence 28/05' },
  },
  {
    id: 'rl_11', accountId: 'acc_01', date: '2026-05-13',
    desc: 'PIX RECEBIDO ANA PAULA RODRIGUES', counterparty: 'Ana Paula Rodrigues',
    amount: 3950, status: 'MATCHED', confidence: 1,
    match: { kind: 'receivable', id: 'recv_06', title: 'Aluguel — Apto 33 Bela Vista', sub: 'Maio · vence 13/05' },
  },
  {
    id: 'rl_12', accountId: 'acc_01', date: '2026-05-14',
    desc: 'DEBITO IOF TARIFA BANCARIA', counterparty: 'Itaú Unibanco',
    amount: -12.50, status: 'UNMATCHED', confidence: 0,
    match: null,
  },
  {
    id: 'rl_13', accountId: 'acc_01', date: '2026-05-15',
    desc: 'PIX RECEBIDO FERNANDO LOPES CARDOSO', counterparty: 'Fernando L. Cardoso',
    amount: 2750, status: 'MATCHED', confidence: 1,
    match: { kind: 'receivable', id: 'recv_07', title: 'Aluguel — Studio 201 Pinheiros', sub: 'Maio · vence 15/05' },
  },
  {
    id: 'rl_21', accountId: 'acc_02', date: '2026-05-03',
    desc: 'DEP CAUCAO INQUILINO SILVA', counterparty: 'Inquilino Silva',
    amount: 6500, status: 'MATCHED', confidence: 1,
    match: { kind: 'receivable', id: 'recv_10', title: 'Caução — Contrato LSE-2026-411', sub: 'Entrada · 03/05' },
  },
  {
    id: 'rl_22', accountId: 'acc_02', date: '2026-05-10',
    desc: 'DEV CAUCAO INQUILINO ANTIGA', counterparty: 'Inquilino Costa',
    amount: -3200, status: 'SUGGESTED', confidence: 0.88,
    match: { kind: 'payable', id: 'pay_10', title: 'Devolução caução — LSE-2024-188', sub: 'Encerrado · 30/04' },
  },
  {
    id: 'rl_31', accountId: 'acc_03', date: '2026-05-08',
    desc: 'PIX RECEBIDO VARIOS CLIENTES', counterparty: 'Vários',
    amount: 4200, status: 'UNMATCHED', confidence: 0,
    match: null,
  },
]

function buildReconCounts(lines: ReconLine[]) {
  return {
    total: lines.length,
    matched: lines.filter(l => l.status === 'MATCHED').length,
    suggested: lines.filter(l => l.status === 'SUGGESTED').length,
    unmatched: lines.filter(l => l.status === 'UNMATCHED').length,
    manual: lines.filter(l => l.status === 'MANUAL').length,
  }
}

export async function getBankAccounts(): Promise<BankAccount[]> {
  // TODO(api): GET /api/v1/bank-accounts
  return BANK_ACCOUNTS_SEED
}

export async function getReconciliation(params: {
  accountId: string
  from?: string
  to?: string
}): Promise<ReconciliationResponse> {
  // TODO(api): GET /api/v1/reconciliation?accountId=...
  const account = BANK_ACCOUNTS_SEED.find(a => a.id === params.accountId) ?? BANK_ACCOUNTS_SEED[0]
  const lines = RECON_LINES_SEED.filter(l => l.accountId === account.id)
  return {
    account,
    period: { from: '2026-05-01', to: '2026-05-31' },
    lines,
    counts: buildReconCounts(lines),
  }
}

export async function importStatement(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<{ ok: boolean; linesImported: number; suggestionsFound: number; unmatchedCount: number }> {
  // TODO(api): POST /api/v1/reconciliation/import (multipart)
  revalidatePath('/financial/reconciliation')
  return { ok: true, linesImported: 18, suggestionsFound: 12, unmatchedCount: 3 }
}

export async function confirmMatch(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _lineId: string,
): Promise<{ ok: boolean }> {
  // TODO(api): POST /api/v1/reconciliation/:lineId/confirm
  revalidatePath('/financial/reconciliation')
  revalidatePath('/financial/receivables')
  revalidatePath('/financial/payables')
  return { ok: true }
}

export async function linkLine(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _lineId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _targetType: 'receivable' | 'payable',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _targetId: string,
): Promise<{ ok: boolean }> {
  // TODO(api): POST /api/v1/reconciliation/:lineId/link
  revalidatePath('/financial/reconciliation')
  return { ok: true }
}

export async function markAvulso(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _lineId: string,
): Promise<{ ok: boolean }> {
  // TODO(api): POST /api/v1/reconciliation/:lineId/avulso
  revalidatePath('/financial/reconciliation')
  return { ok: true }
}

export async function createFromLine(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _lineId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _input: {
    kind: 'receivable' | 'payable'
    property: string
    category: string
    amount: number
    counterparty: string
    description: string
  },
): Promise<{ ok: boolean; createdId: string }> {
  // TODO(api): POST /api/v1/reconciliation/:lineId/create-receivable OR /create-payable
  revalidatePath('/financial/reconciliation')
  return { ok: true, createdId: 'new_item_id' }
}

export async function undoMatch(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _lineId: string,
): Promise<{ ok: boolean }> {
  // TODO(api): POST /api/v1/reconciliation/:lineId/undo
  revalidatePath('/financial/reconciliation')
  return { ok: true }
}

export async function batchConfirmRecon(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _accountId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _minConfidence: number,
): Promise<{ ok: boolean; confirmed: number }> {
  // TODO(api): POST /api/v1/reconciliation/batch-confirm
  revalidatePath('/financial/reconciliation')
  return { ok: true, confirmed: 3 }
}

export async function searchSuggestions(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _lineId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _query?: string,
): Promise<MatchCandidate[]> {
  // TODO(api): GET /api/v1/reconciliation/suggestions/:lineId?q=...
  return [
    { id: 'recv_01', kind: 'receivable', title: 'Aluguel — Apto 101 Solar Ipanema', sub: 'Maio · vence 05/05', amount: 3250 },
    { id: 'recv_05', kind: 'receivable', title: 'Aluguel — Quitinete 4B Centro', sub: 'Maio · vence 10/05', amount: 1850 },
    { id: 'pay_01', kind: 'payable', title: 'Condomínio — Ap. 304 Res. Alfa', sub: 'Maio · vence 20/05', amount: 650 },
  ]
}

// ─── Phase 5: Commissions ────────────────────────────────────────────────────

export type CommissionStatus = 'PENDING' | 'APPROVED' | 'PAID'
export type CommissionOperation = 'LEASE' | 'SALE' | 'CAPTURE'
export type BrokerRegime = 'MEI' | 'Autônomo' | 'CLT'

export interface Broker {
  id: string
  name: string
  regime: BrokerRegime
  irrfDefault: number
  avatar?: string
}

export interface CommissionItem {
  id: string
  brokerId: string
  brokerSplit: number
  captureBrokerId: string | null
  operation: CommissionOperation
  property: string
  contractId: string
  base: number
  pct: number
  gross: number
  irrf: number
  net: number
  status: CommissionStatus
  createdAt: string
  paidAt?: string
  payableId?: string
  note?: string
  tab: CommissionOperation
}

export interface CommissionsResponse {
  commissions: CommissionItem[]
  brokers: Broker[]
  totals: {
    pending: number
    approved: number
    paid: number
    irrf: number
  }
}

const BROKERS_SEED: Broker[] = [
  { id: 'b_01', name: 'Marcos Tavares', regime: 'MEI', irrfDefault: 0, avatar: 'MT' },
  { id: 'b_02', name: 'Júlia Resende', regime: 'Autônomo', irrfDefault: 0.075, avatar: 'JR' },
  { id: 'b_03', name: 'Pedro Albuquerque', regime: 'CLT', irrfDefault: 0, avatar: 'PA' },
  { id: 'b_04', name: 'Sofia Domingues', regime: 'Autônomo', irrfDefault: 0.15, avatar: 'SD' },
  { id: 'b_05', name: 'Eduardo Lima', regime: 'MEI', irrfDefault: 0, avatar: 'EL' },
]

const COMMISSIONS_SEED: CommissionItem[] = [
  { id: 'c_001', brokerId: 'b_01', brokerSplit: 1.00, captureBrokerId: null, operation: 'LEASE', property: 'Apto 101 — Solar Ipanema', contractId: 'LSE-2026-411', base: 3250, pct: 1.00, gross: 3250, irrf: 0, net: 3250, status: 'PENDING', createdAt: '2026-05-08', tab: 'LEASE', note: 'Locação 12 meses, captação direta' },
  { id: 'c_002', brokerId: 'b_02', brokerSplit: 0.50, captureBrokerId: 'b_03', operation: 'LEASE', property: 'Casa 3 — Vila Madalena', contractId: 'LSE-2026-412', base: 2890, pct: 1.00, gross: 1445, irrf: 108.38, net: 1336.62, status: 'APPROVED', createdAt: '2026-05-09', tab: 'LEASE', note: 'Split 50/50 com captador' },
  { id: 'c_003', brokerId: 'b_03', brokerSplit: 0.50, captureBrokerId: 'b_03', operation: 'LEASE', property: 'Casa 3 — Vila Madalena', contractId: 'LSE-2026-412', base: 2890, pct: 1.00, gross: 1445, irrf: 0, net: 1445, status: 'APPROVED', createdAt: '2026-05-09', tab: 'LEASE', note: 'Captação Pedro · split 50/50' },
  { id: 'c_004', brokerId: 'b_04', brokerSplit: 1.00, captureBrokerId: null, operation: 'LEASE', property: 'Sala 502 — Faria Lima', contractId: 'LSE-2026-413', base: 4100, pct: 1.00, gross: 4100, irrf: 615, net: 3485, status: 'PAID', createdAt: '2026-05-02', tab: 'LEASE', paidAt: '2026-05-10' },
  { id: 'c_005', brokerId: 'b_05', brokerSplit: 1.00, captureBrokerId: null, operation: 'LEASE', property: 'Apto 22 — Cobertura Sul', contractId: 'LSE-2026-414', base: 2640, pct: 1.00, gross: 2640, irrf: 0, net: 2640, status: 'PAID', createdAt: '2026-04-28', tab: 'LEASE', paidAt: '2026-05-04' },
  { id: 'c_101', brokerId: 'b_01', brokerSplit: 1.00, captureBrokerId: null, operation: 'SALE', property: 'Casa 18 — Vila Olímpia', contractId: 'SALE-2026-22', base: 1280000, pct: 0.06, gross: 76800, irrf: 0, net: 76800, status: 'PENDING', createdAt: '2026-05-12', tab: 'SALE' },
  { id: 'c_102', brokerId: 'b_02', brokerSplit: 0.60, captureBrokerId: 'b_04', operation: 'SALE', property: 'Apto 901 — Atlântico', contractId: 'SALE-2026-23', base: 980000, pct: 0.06, gross: 35280, irrf: 5292, net: 29988, status: 'APPROVED', createdAt: '2026-05-13', tab: 'SALE' },
  { id: 'c_103', brokerId: 'b_04', brokerSplit: 0.40, captureBrokerId: 'b_04', operation: 'SALE', property: 'Apto 901 — Atlântico', contractId: 'SALE-2026-23', base: 980000, pct: 0.06, gross: 23520, irrf: 6468, net: 17052, status: 'APPROVED', createdAt: '2026-05-13', tab: 'SALE' },
  { id: 'c_201', brokerId: 'b_03', brokerSplit: 0.20, captureBrokerId: 'b_03', operation: 'CAPTURE', property: 'Apto 33 — Bela Vista', contractId: 'CAP-2026-09', base: 3950, pct: 1.00, gross: 790, irrf: 0, net: 790, status: 'PAID', createdAt: '2026-04-22', tab: 'CAPTURE', paidAt: '2026-04-30' },
  { id: 'c_202', brokerId: 'b_05', brokerSplit: 0.20, captureBrokerId: 'b_05', operation: 'CAPTURE', property: 'Casa 18 — Vila Olímpia', contractId: 'CAP-2026-10', base: 4400, pct: 1.00, gross: 880, irrf: 0, net: 880, status: 'PENDING', createdAt: '2026-05-04', tab: 'CAPTURE' },
]

function buildCommTotals(commissions: CommissionItem[]) {
  return {
    pending: commissions.filter(c => c.status === 'PENDING').reduce((s, c) => s + c.net, 0),
    approved: commissions.filter(c => c.status === 'APPROVED').reduce((s, c) => s + c.net, 0),
    paid: commissions.filter(c => c.status === 'PAID').reduce((s, c) => s + c.net, 0),
    irrf: commissions.reduce((s, c) => s + c.irrf, 0),
  }
}

export async function getCommissionsData(params?: {
  operation?: CommissionOperation
  status?: CommissionStatus
  brokerId?: string
}): Promise<CommissionsResponse> {
  // TODO(api): GET /api/v1/commissions
  let commissions = COMMISSIONS_SEED
  if (params?.operation) commissions = commissions.filter(c => c.operation === params.operation)
  if (params?.status) commissions = commissions.filter(c => c.status === params.status)
  if (params?.brokerId) commissions = commissions.filter(c => c.brokerId === params.brokerId)
  return {
    commissions,
    brokers: BROKERS_SEED,
    totals: buildCommTotals(commissions),
  }
}

export async function getBrokersData(): Promise<Broker[]> {
  // TODO(api): GET /api/v1/brokers
  return BROKERS_SEED
}

export async function createCommission(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _input: {
    operation: CommissionOperation
    brokerId: string
    captureBrokerId?: string
    splitOperator?: number
    property: string
    contractId: string
    base: number
    pct: number
    description?: string
  },
): Promise<{ ok: boolean; ids: string[] }> {
  // TODO(api): POST /api/v1/commissions
  revalidatePath('/financial/commissions')
  return { ok: true, ids: ['new_comm_id'] }
}

export async function approveCommission(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _id: string,
): Promise<{ ok: boolean }> {
  // TODO(api): POST /api/v1/commissions/:id/approve
  revalidatePath('/financial/commissions')
  return { ok: true }
}

export async function rejectCommission(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _id: string,
): Promise<{ ok: boolean }> {
  // TODO(api): POST /api/v1/commissions/:id/reject
  revalidatePath('/financial/commissions')
  return { ok: true }
}

export async function payCommission(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _id: string,
): Promise<{ ok: boolean; payableId: string }> {
  // TODO(api): POST /api/v1/commissions/:id/pay — backend cria Payable category=COMMISSION
  revalidatePath('/financial/commissions')
  revalidatePath('/financial/payables')
  return { ok: true, payableId: 'new_payable_id' }
}

export async function undoApproveCommission(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _id: string,
): Promise<{ ok: boolean }> {
  // TODO(api): POST /api/v1/commissions/:id/undo-approve
  revalidatePath('/financial/commissions')
  return { ok: true }
}

export async function refundCommission(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _id: string,
): Promise<{ ok: boolean }> {
  // TODO(api): POST /api/v1/commissions/:id/refund
  revalidatePath('/financial/commissions')
  revalidatePath('/financial/payables')
  return { ok: true }
}

export async function batchApproveCommissions(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ids: string[],
): Promise<{ ok: boolean; approved: number }> {
  // TODO(api): POST /api/v1/commissions/batch-approve
  revalidatePath('/financial/commissions')
  return { ok: true, approved: _ids.length }
}

export async function batchPayCommissions(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ids: string[],
): Promise<{ ok: boolean; paid: number; payableIds: string[] }> {
  // TODO(api): POST /api/v1/commissions/batch-pay
  revalidatePath('/financial/commissions')
  revalidatePath('/financial/payables')
  return { ok: true, paid: _ids.length, payableIds: _ids.map(id => `payable_${id}`) }
}

// ─── Leases ──────────────────────────────────────────────────────────────────

interface GoLease {
  id: string
  unit_id: string
  tenant_id: string
  rent_amount: number
  status: string
}

interface GoTenant {
  id: string
  name: string
}

export interface ActiveLease {
  id: string
  label: string
}

export async function getActiveLeases(): Promise<ActiveLease[]> {
  try {
    const [leases, tenants] = await Promise.all([
      goFetch<GoLease[]>('/api/v1/leases'),
      goFetch<GoTenant[]>('/api/v1/tenants'),
    ])
    const tenantMap = new Map(tenants.map((t) => [t.id, t.name]))
    return leases
      .filter((l) => l.status === 'ACTIVE')
      .map((l) => ({
        id: l.id,
        label: `${tenantMap.get(l.tenant_id) ?? l.id.slice(0, 8)} — R$ ${l.rent_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      }))
  } catch (e) {
    console.error('getActiveLeases:', e)
    return []
  }
}

// ─── Create Payment ───────────────────────────────────────────────────────────

const createPaymentSchema = z.object({
  leaseId: z.string().uuid('Selecione um contrato.'),
  dueDate: z.string().min(1, 'Vencimento não pode ser anterior à competência.'),
  grossAmount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero.'),
  type: z.enum(['RENT', 'DEPOSIT', 'EXPENSE', 'OTHER'], {
    error: 'Tipo inválido.',
  }),
  competency: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Competência inválida.')
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .min(0)
    .max(120, 'Descrição é obrigatória (até 120 caracteres).')
    .optional(),
})

export type CreatePaymentFieldErrors = Partial<
  Record<'leaseId' | 'dueDate' | 'grossAmount' | 'type' | 'competency' | 'description', string>
>

export type CreatePaymentResult =
  | { ok: true }
  | { ok: false; kind: 'validation'; fieldErrors: CreatePaymentFieldErrors }
  | { ok: false; kind: 'server'; httpStatus: number }

export async function createPayment(
  _prevState: unknown,
  formData: FormData,
): Promise<CreatePaymentResult> {
  const parsed = createPaymentSchema.safeParse({
    leaseId: formData.get('leaseId'),
    dueDate: formData.get('dueDate'),
    grossAmount: formData.get('grossAmount'),
    type: formData.get('type'),
    competency: formData.get('competency') || undefined,
    description: formData.get('description') || undefined,
  })

  if (!parsed.success) {
    const fieldErrors: CreatePaymentFieldErrors = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof CreatePaymentFieldErrors
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }
    return { ok: false, kind: 'validation', fieldErrors }
  }

  const { leaseId, dueDate, grossAmount, type, competency, description } =
    parsed.data

  try {
    const res = await goFetch(`/api/v1/leases/${leaseId}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        due_date: `${dueDate}T00:00:00Z`,
        gross_amount: grossAmount,
        type,
        ...(competency ? { competency } : {}),
        ...(description ? { description } : {}),
      }),
    })
    void res
    revalidatePath('/financial/receivables')
    return { ok: true }
  } catch {
    return { ok: false, kind: 'server', httpStatus: 0 }
  }
}
// ─── Phase 2: Payables ───────────────────────────────────────────────────────

export type PayableStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'SCHEDULED'
export type PayableTab = 'VENDOR' | 'TAX'
export type { PayableCategory } from './constants'
import type { PayableCategory } from './constants'

export interface Payable {
  id: string
  due: string
  supplier: string
  property: string
  propertyId?: string
  category: string
  categoryKey: PayableCategory
  amount: number
  method: 'PIX' | 'Boleto' | 'Cartão' | 'TED'
  status: PayableStatus
  reference: string
  tab: PayableTab
  invoice: string
  description?: string
  reimburseToOwner: boolean
  scheduledFor?: string
}

const PAYABLES_SEED: Payable[] = [
  {
    id: 'p1', due: '2026-05-10', supplier: 'Construtora Silva & Filhos',
    property: 'Ap. 201 — Ed. Beira Mar', category: 'Reparo elétrico',
    categoryKey: 'REPAIR_ELECTRIC', amount: 480, method: 'PIX',
    status: 'OVERDUE', reference: '2026-05', tab: 'VENDOR',
    invoice: 'NF-2847', reimburseToOwner: true,
  },
  {
    id: 'p2', due: '2026-05-20', supplier: 'Condomínio Residencial Alfa',
    property: 'Ap. 304 — Res. Alfa', category: 'Condomínio',
    categoryKey: 'CONDO', amount: 650, method: 'Boleto',
    status: 'PENDING', reference: '2026-05', tab: 'TAX',
    invoice: 'BOL-0542', reimburseToOwner: false,
  },
  {
    id: 'p3', due: '2026-05-31', supplier: 'Prefeitura Municipal',
    property: 'Casa 1 — Jd. América', category: 'IPTU',
    categoryKey: 'IPTU', amount: 1200, method: 'Boleto',
    status: 'SCHEDULED', scheduledFor: '2026-05-31',
    reference: '2026-05', tab: 'TAX', invoice: 'DARF-2026',
    reimburseToOwner: true,
  },
  {
    id: 'p4', due: '2026-04-30', supplier: 'CleanPro Serviços',
    property: 'Ap. 201 — Ed. Beira Mar', category: 'Limpeza',
    categoryKey: 'CLEAN', amount: 320, method: 'PIX',
    status: 'PAID', reference: '2026-04', tab: 'VENDOR',
    invoice: 'NF-1023', reimburseToOwner: false,
  },
  {
    id: 'p5', due: '2026-04-15', supplier: 'Receita Federal',
    property: 'Ap. 304 — Res. Alfa', category: 'Imposto / carnê-leão',
    categoryKey: 'TAX', amount: 890, method: 'Boleto',
    status: 'PAID', reference: '2026-04', tab: 'TAX',
    invoice: 'DARF-0044', reimburseToOwner: false,
  },
  {
    id: 'p6', due: '2026-05-28', supplier: 'Dexter Dedetizações',
    property: 'Casa 1 — Jd. América', category: 'Dedetização',
    categoryKey: 'PEST', amount: 250, method: 'PIX',
    status: 'PENDING', reference: '2026-05', tab: 'VENDOR',
    invoice: 'NF-3310', reimburseToOwner: true,
  },
]

export async function getPayables(): Promise<Payable[]> {
  return PAYABLES_SEED
}

export type CreateExpenseFieldErrors = Partial<Record<
  'category' | 'propertyId' | 'supplier' | 'dueDate' | 'amount' | 'method' | 'description',
  string
>>

export type CreateExpenseResult =
  | { ok: true }
  | { ok: false; kind: 'validation'; fieldErrors: CreateExpenseFieldErrors }
  | { ok: false; kind: 'server'; httpStatus: number }

const createExpenseSchema = z.object({
  category: z.enum([
    'REPAIR_HYDRAULIC', 'REPAIR_ELECTRIC', 'PAINT', 'CLEAN',
    'PEST', 'FURNITURE', 'CONDO', 'IPTU', 'TAX', 'OTHER',
  ] as const, { error: 'Selecione uma categoria.' }),
  propertyId: z.string().uuid('Selecione um imóvel.'),
  supplier: z.string().trim().min(1, 'Informe o fornecedor.').max(80),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
  amount: z.coerce.number().positive('Valor deve ser maior que zero.'),
  method: z.enum(['PIX', 'Boleto', 'Cartão', 'TED'] as const),
  description: z.string().max(120).optional(),
  reimburseToOwner: z.coerce.boolean().default(true),
})

export async function createExpense(
  _prevState: unknown,
  formData: FormData,
): Promise<CreateExpenseResult> {
  const parsed = createExpenseSchema.safeParse({
    category:        formData.get('category'),
    propertyId:      formData.get('propertyId'),
    supplier:        formData.get('supplier'),
    dueDate:         formData.get('dueDate'),
    amount:          formData.get('amount'),
    method:          formData.get('method'),
    description:     formData.get('description') || undefined,
    reimburseToOwner: formData.get('reimburseToOwner') === 'true',
  })

  if (!parsed.success) {
    const fieldErrors: CreateExpenseFieldErrors = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof CreateExpenseFieldErrors
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message
    }
    return { ok: false, kind: 'validation', fieldErrors }
  }

  try {
    await goFetch('/api/v1/expenses', {
      method: 'POST',
      body: JSON.stringify({
        category: parsed.data.category,
        unit_id: parsed.data.propertyId,
        description: parsed.data.supplier,
        amount: parsed.data.amount,
        due_date: `${parsed.data.dueDate}T00:00:00Z`,
      }),
    })
    revalidatePath('/financial/payables')
    return { ok: true }
  } catch {
    return { ok: false, kind: 'server', httpStatus: 0 }
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function markPaid(_id: string): Promise<{ ok: boolean }> {
  return { ok: true }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function schedulePayable(_id: string, _date: string): Promise<{ ok: boolean }> {
  return { ok: true }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function cancelSchedule(_id: string): Promise<{ ok: boolean }> {
  return { ok: true }
}

// ─── Phase 3: Transfers ──────────────────────────────────────────────────────

export type TransferStatus = 'PENDING' | 'APPROVED' | 'SENT'

export interface Transfer {
  id: string
  owner: string
  ownerId: string
  properties: number
  gross: number
  fee: number
  tax: number
  iptu: number
  net: number
  status: TransferStatus
  referenceMonth: string
  scheduledDate?: string
  sentAt?: string
  cnabExported?: boolean
}

export interface TransfersResponse {
  month: string
  totalNet: number
  processDate: string
  transfers: Transfer[]
}

const TRANSFERS_SEED: TransfersResponse = {
  month: '2026-05',
  totalNet: 42190,
  processDate: '2026-06-03',
  transfers: [
    {
      id: 't1', owner: 'João Batista Ferreira', ownerId: 'o1',
      properties: 3, gross: 12400, fee: 1240, tax: 186, iptu: 320, net: 10654,
      status: 'PENDING', referenceMonth: '2026-05',
    },
    {
      id: 't2', owner: 'Maria das Dores Costa', ownerId: 'o2',
      properties: 2, gross: 9800, fee: 980, tax: 147, iptu: 0, net: 8673,
      status: 'APPROVED', scheduledDate: '2026-06-03', referenceMonth: '2026-05',
    },
    {
      id: 't3', owner: 'Construtora Alfa S.A.', ownerId: 'o3',
      properties: 5, gross: 28600, fee: 2860, tax: 429, iptu: 800, net: 24511,
      status: 'SENT', sentAt: '2026-05-28T10:30:00Z', cnabExported: true, referenceMonth: '2026-05',
    },
    {
      id: 't4', owner: 'Paulo Henrique Almeida', ownerId: 'o4',
      properties: 1, gross: 2100, fee: 210, tax: 31.5, iptu: 0, net: 1858.5,
      status: 'PENDING', referenceMonth: '2026-05',
    },
  ],
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getTransfers(_month?: string): Promise<TransfersResponse> {
  return TRANSFERS_SEED
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function approveTransfer(_id: string): Promise<{ ok: boolean }> {
  revalidatePath('/financial/transfers')
  return { ok: true }
}

export async function batchApproveTransfers(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _month: string,
): Promise<{ ok: boolean; approved: number }> {
  revalidatePath('/financial/transfers')
  return { ok: true, approved: 2 }
}

export async function exportTransfersCNAB(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _month: string,
): Promise<{ ok: boolean; url?: string }> {
  return { ok: true, url: '#' }
}
