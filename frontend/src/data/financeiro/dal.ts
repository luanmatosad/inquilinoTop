// data/financeiro/dal.ts

export type TransactionStatus = 'Pago' | 'Pendente' | 'Atrasado';

export interface Recebimento {
  id: string;
  vencimento: string; // ISO date
  pagador: string;
  imovel: string;
  valor: number;
  formaPagto: 'Boleto' | 'PIX' | 'Cartão';
  status: TransactionStatus;
  tipo: 'Aluguel' | 'Parcela de Venda' | 'Taxa Condominial';
}

export interface Pagamento {
  id: string;
  vencimento: string; // ISO date
  fornecedor: string;
  categoria: 'IPTU' | 'Condomínio' | 'Manutenção' | 'DARF' | 'Outro';
  valor: number;
  imovelVinculado: string;
  status: TransactionStatus;
}

export interface BankRecord {
  id: string;
  data: string;
  descricao: string;
  valor: number;
}

export interface Repasse {
  id: string;
  proprietario: string;
  imoveis: string;
  recebimentoBruto: number;
  taxaAdmPerc: number;
  taxaAdmValor: number;
  descontos: number; // IRRF, IPTU retido, etc
  valorLiquido: number;
  status: 'Pendente' | 'Processado' | 'Transferido';
}

export interface Comissao {
  id: string;
  corretor: string;
  tipo: 'Venda' | 'Locação';
  valorBase: number;
  percentual: number;
  retencaoISS: number;
  retencaoIRRF: number;
  valorPagar: number;
  imovel: string;
}

export interface DashboardMetrics {
  receitaPrevista: number;
  receitaRealizada: number;
  inadimplenciaPerc: number;
  valorGeralAluguel: number;
  totalRepassar: number;
}

// MOCK DATA

const mockRecebimentos: Recebimento[] = [
  { id: '1', vencimento: '2026-05-05', pagador: 'João Silva', imovel: 'Apto 101 - Ed. Solar', valor: 2500, formaPagto: 'PIX', status: 'Pago', tipo: 'Aluguel' },
  { id: '2', vencimento: '2026-05-10', pagador: 'Maria Souza', imovel: 'Casa 3 - Cond. Flores', valor: 3200, formaPagto: 'Boleto', status: 'Pendente', tipo: 'Aluguel' },
  { id: '3', vencimento: '2026-04-20', pagador: 'Carlos Santos', imovel: 'Loja 2 - Centro', valor: 4500, formaPagto: 'PIX', status: 'Atrasado', tipo: 'Aluguel' },
  { id: '4', vencimento: '2026-05-15', pagador: 'Pedro Almeida', imovel: 'Apto 402 - Ed. Lua', valor: 1500, formaPagto: 'Boleto', status: 'Pendente', tipo: 'Taxa Condominial' },
];

const mockPagamentos: Pagamento[] = [
  { id: '1', vencimento: '2026-05-08', fornecedor: 'Prefeitura', categoria: 'IPTU', valor: 350, imovelVinculado: 'Apto 101 - Ed. Solar', status: 'Pago' },
  { id: '2', vencimento: '2026-05-12', fornecedor: 'Condomínio Solar', categoria: 'Condomínio', valor: 600, imovelVinculado: 'Apto 101 - Ed. Solar', status: 'Pendente' },
  { id: '3', vencimento: '2026-05-02', fornecedor: 'Receita Federal', categoria: 'DARF', valor: 450, imovelVinculado: 'Geral', status: 'Atrasado' },
];

const mockRepasses: Repasse[] = [
  { id: '1', proprietario: 'Ana Oliveira', imoveis: 'Apto 101 - Ed. Solar', recebimentoBruto: 2500, taxaAdmPerc: 10, taxaAdmValor: 250, descontos: 150, valorLiquido: 2100, status: 'Transferido' },
  { id: '2', proprietario: 'Ricardo Mendes', imoveis: 'Casa 3 - Cond. Flores, Loja 2', recebimentoBruto: 7700, taxaAdmPerc: 10, taxaAdmValor: 770, descontos: 0, valorLiquido: 6930, status: 'Pendente' },
];

const mockComissoes: Comissao[] = [
  { id: '1', corretor: 'Fernanda Costa', tipo: 'Locação', valorBase: 2500, percentual: 50, retencaoISS: 62.5, retencaoIRRF: 0, valorPagar: 1187.5, imovel: 'Apto 101' },
  { id: '2', corretor: 'Roberto Dias', tipo: 'Venda', valorBase: 350000, percentual: 6, retencaoISS: 420, retencaoIRRF: 3150, valorPagar: 17430, imovel: 'Casa 5' },
];

const mockBankRecords: BankRecord[] = [
  { id: 'b1', data: '2026-05-05', descricao: 'PIX RECEBIDO - JOAO SILVA', valor: 2500 },
  { id: 'b2', data: '2026-05-08', descricao: 'PAG TITULO - PREFEITURA', valor: -350 },
  { id: 'b3', data: '2026-05-06', descricao: 'TRANSF PIX - JOSE', valor: 1500 },
];

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  // Simulating API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    receitaPrevista: 45000,
    receitaRealizada: 32500,
    inadimplenciaPerc: 4.2,
    valorGeralAluguel: 125000,
    totalRepassar: 28500
  };
}

export async function getRecebimentos(): Promise<Recebimento[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockRecebimentos;
}

export async function getPagamentos(): Promise<Pagamento[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockPagamentos;
}

export async function getRepasses(): Promise<Repasse[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockRepasses;
}

export async function getComissoes(): Promise<Comissao[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockComissoes;
}

export async function getBankRecords(): Promise<BankRecord[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockBankRecords;
}
