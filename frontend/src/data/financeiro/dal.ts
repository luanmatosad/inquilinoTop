// Tipos do módulo financeiro — implementação em src/app/financeiro/actions.ts

export type TransactionStatus = 'Pago' | 'Pendente' | 'Atrasado'

export interface Recebimento {
  id: string
  vencimento: string
  pagador: string
  imovel: string
  valor: number
  formaPagto: 'Boleto' | 'PIX' | 'Cartão'
  status: TransactionStatus
  tipo: 'Aluguel' | 'Parcela de Venda' | 'Taxa Condominial'
}

export interface Pagamento {
  id: string
  vencimento: string
  fornecedor: string
  categoria: 'IPTU' | 'Condomínio' | 'Manutenção' | 'DARF' | 'Outro'
  valor: number
  imovelVinculado: string
  status: TransactionStatus
}

export interface BankRecord {
  id: string
  data: string
  descricao: string
  valor: number
}

export interface Repasse {
  id: string
  proprietario: string
  imoveis: string
  recebimentoBruto: number
  taxaAdmPerc: number
  taxaAdmValor: number
  descontos: number
  valorLiquido: number
  status: 'Pendente' | 'Processado' | 'Transferido'
}

export interface Comissao {
  id: string
  corretor: string
  tipo: 'Venda' | 'Locação'
  valorBase: number
  percentual: number
  retencaoISS: number
  retencaoIRRF: number
  valorPagar: number
  imovel: string
}

export interface DashboardMetrics {
  receitaPrevista: number
  receitaRealizada: number
  inadimplenciaPerc: number
  valorGeralAluguel: number
  totalRepassar: number
}
