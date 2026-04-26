'use client'

import React, { useState, useEffect } from 'react';
import { getRecebimentos, Recebimento, TransactionStatus } from '../actions';
import { Search, Plus, Filter, MoreVertical, FileText, Send, CheckCircle, FilePlus2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

function StatusBadge({ status }: { status: TransactionStatus }) {
  if (status === 'Pago') {
    return <span className="px-2 py-1 bg-success/10 text-success text-xs rounded-full font-medium">Pago</span>;
  }
  if (status === 'Pendente') {
    return <span className="px-2 py-1 bg-warning/10 text-warning text-xs rounded-full font-medium">Pendente</span>;
  }
  return <span className="px-2 py-1 bg-error/10 text-error text-xs rounded-full font-medium">Atrasado</span>;
}

export default function ContasReceber() {
  const [data, setData] = useState<Recebimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'Todos'>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'Aluguel' | 'Parcela de Venda' | 'Taxa Condominial'>('Aluguel');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    getRecebimentos().then(res => {
      setData(res);
      setLoading(false);
    });
  }, []);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const filtered = data.filter(item => {
    const matchStatus = filterStatus === 'Todos' || item.status === filterStatus;
    const matchTab = item.tipo === activeTab;
    const matchSearch = item.pagador.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        item.imovel.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchTab && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Contas a Receber</h1>
          <p className="text-on-surface-variant">Gestão de cobranças e recebimentos</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova Cobrança
        </Button>
      </div>

      <div className="flex gap-4 border-b border-outline-variant">
        {['Aluguel', 'Parcela de Venda', 'Taxa Condominial'].map(tab => (
          <button
            key={tab}
            className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === tab ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-surface p-4 rounded-lg border border-outline-variant shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input 
            type="text" 
            placeholder="Buscar por pagador ou imóvel..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-surface-container-low border border-outline rounded-md focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-on-surface-variant" />
          <select 
            className="text-sm bg-surface border border-outline rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="Todos">Todos os Status</option>
            <option value="Pago">Pago</option>
            <option value="Pendente">Pendente</option>
            <option value="Atrasado">Atrasado</option>
          </select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-variant text-on-surface-variant uppercase text-xs">
              <tr>
                <th className="px-6 py-3 font-medium">Vencimento</th>
                <th className="px-6 py-3 font-medium">Pagador</th>
                <th className="px-6 py-3 font-medium">Imóvel / Contrato</th>
                <th className="px-6 py-3 font-medium">Valor</th>
                <th className="px-6 py-3 font-medium">Forma Pagto</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant">Nenhuma cobrança encontrada.</td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">{formatDate(item.vencimento)}</td>
                  <td className="px-6 py-4 font-medium text-on-surface">{item.pagador}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{item.imovel}</td>
                  <td className="px-6 py-4 font-semibold">{formatBRL(item.valor)}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{item.formaPagto}</td>
                  <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-md transition-colors" title="Opções">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Nova Cobrança */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-xl shadow-lg w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
              <h2 className="text-lg font-bold">Gerar Nova Cobrança</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">✕</button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Selecionar Contrato</label>
                  <select className="w-full text-sm bg-surface border border-outline rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-primary">
                    <option>João Silva - Apto 101</option>
                    <option>Maria Souza - Casa 3</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Vencimento</label>
                    <input type="date" className="w-full text-sm bg-surface border border-outline rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Valor (R$)</label>
                    <input type="text" placeholder="0,00" className="w-full text-sm bg-surface border border-outline rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Multa por atraso (%)</label>
                  <input type="number" defaultValue="2" className="w-full text-sm bg-surface border border-outline rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <button className="text-sm text-primary font-medium flex items-center gap-1 hover:underline">
                  <Plus className="w-3 h-3" /> Adicionar Despesa Extraordinária
                </button>
              </div>

              {/* Preview UI */}
              <div className="bg-surface-container-low p-4 rounded-lg border border-outline-variant flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-24 h-24 bg-white p-2 rounded border border-outline shadow-sm flex items-center justify-center">
                  <div className="w-full h-full bg-black/10 rounded-sm flex items-center justify-center">QR</div>
                </div>
                <div>
                  <p className="text-sm font-bold">Preview da Cobrança</p>
                  <p className="text-xs text-on-surface-variant">O inquilino receberá um link com PIX Copia e Cola e o Boleto bancário.</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button onClick={() => setIsModalOpen(false)}>Gerar e Enviar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}