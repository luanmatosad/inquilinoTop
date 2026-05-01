'use client'

import React, { useState, useEffect } from 'react';
import { getPayables, Payable, TransactionStatus } from '../actions';
import { Search, Plus, Filter, MoreVertical, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

function StatusBadge({ status }: { status: TransactionStatus }) {
  if (status === 'PAID') {
    return <span className="px-2 py-1 bg-success/10 text-success text-xs rounded-full font-medium">Pago</span>;
  }
  if (status === 'PENDING') {
    return <span className="px-2 py-1 bg-warning/10 text-warning text-xs rounded-full font-medium">Pendente</span>;
  }
  return <span className="px-2 py-1 bg-error/10 text-error text-xs rounded-full font-medium">Atrasado</span>;
}

export default function PayablesPage() {
  const [data, setData] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getPayables().then(res => {
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

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(i => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const filtered = data.filter(item => {
    const matchCategory = filterCategory === 'ALL' || item.category === filterCategory;
    const matchSearch = item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        item.relatedProperty.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Contas a Pagar</h1>
          <p className="text-on-surface-variant">Gestão de despesas e obrigações</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <Button variant="outline" className="flex items-center gap-2 border-primary text-primary hover:bg-primary/5">
              <CheckCircle className="w-4 h-4" /> Pagar Selecionados ({selectedIds.size})
            </Button>
          )}
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nova Despesa
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-surface p-4 rounded-lg border border-outline-variant shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input 
            type="text" 
            placeholder="Buscar por fornecedor ou imóvel..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-surface-container-low border border-outline rounded-md focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-on-surface-variant" />
          <select 
            className="text-sm bg-surface border border-outline rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="ALL">Todas Categorias</option>
            <option value="PROPERTY_TAX">IPTU</option>
            <option value="CONDO_FEE">Condomínio</option>
            <option value="MAINTENANCE">Manutenção</option>
            <option value="TAX">DARF/Impostos</option>
            <option value="OTHER">Outro</option>
          </select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-variant text-on-surface-variant uppercase text-xs">
              <tr>
                <th className="px-6 py-3 font-medium w-10">
                  <input type="checkbox" className="rounded text-primary focus:ring-primary" 
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 font-medium">Vencimento</th>
                <th className="px-6 py-3 font-medium">Fornecedor / Imposto</th>
                <th className="px-6 py-3 font-medium">Categoria</th>
                <th className="px-6 py-3 font-medium">Valor</th>
                <th className="px-6 py-3 font-medium">Imóvel Vinculado</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-on-surface-variant">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-on-surface-variant">Nenhuma despesa encontrada.</td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-6 py-4">
                    <input type="checkbox" className="rounded text-primary focus:ring-primary"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatDate(item.dueDate)}</td>
                  <td className="px-6 py-4 font-medium text-on-surface">{item.supplier}</td>
                  <td className="px-6 py-4 text-on-surface-variant">
                    {item.category === 'PROPERTY_TAX' ? 'IPTU' :
                     item.category === 'CONDO_FEE' ? 'Condomínio' :
                     item.category === 'MAINTENANCE' ? 'Manutenção' :
                     item.category === 'TAX' ? 'Imposto' : 'Outro'}
                  </td>
                  <td className="px-6 py-4 font-semibold">{formatBRL(item.amount)}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{item.relatedProperty}</td>
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
    </div>
  );
}