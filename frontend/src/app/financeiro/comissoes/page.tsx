'use client'

import React, { useState, useEffect } from 'react';
import { getComissoes, Comissao } from '@/data/financeiro/dal';
import { Search, Percent, SplitSquareHorizontal } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function ComissoesCorretores() {
  const [data, setData] = useState<Comissao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    getComissoes().then(res => {
      setData(res);
      setLoading(false);
    });
  }, []);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const filtered = data.filter(item => 
    item.corretor.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.imovel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Comissões de Corretores</h1>
          <p className="text-on-surface-variant">Gestão de repasses, splits e retenções de impostos (ISS/IRRF)</p>
        </div>
        <Button className="flex items-center gap-2">
          <SplitSquareHorizontal className="w-4 h-4" /> Configurar Regras de Split
        </Button>
      </div>

      <div className="bg-surface p-4 rounded-lg border border-outline-variant shadow-sm w-full sm:w-96 relative">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
        <input 
          type="text" 
          placeholder="Buscar corretor ou imóvel..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-surface-container-low border border-outline rounded-md focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-variant text-on-surface-variant uppercase text-xs">
              <tr>
                <th className="px-6 py-3 font-medium">Corretor</th>
                <th className="px-6 py-3 font-medium">Imóvel / Tipo</th>
                <th className="px-6 py-3 font-medium">Valor Base</th>
                <th className="px-6 py-3 font-medium">% Comissão</th>
                <th className="px-6 py-3 font-medium">Retenções (ISS/IRRF)</th>
                <th className="px-6 py-3 font-medium text-success">Valor a Pagar</th>
                <th className="px-6 py-3 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant">Nenhuma comissão encontrada.</td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4 font-medium text-on-surface">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {item.corretor.charAt(0)}
                      </div>
                      {item.corretor}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-on-surface font-medium">{item.imovel}</p>
                    <p className="text-xs text-on-surface-variant">{item.tipo}</p>
                  </td>
                  <td className="px-6 py-4">{formatBRL(item.valorBase)}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1 text-primary font-medium">
                      <Percent className="w-3 h-3" /> {item.percentual}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-error">
                    <div className="flex flex-col text-xs space-y-1">
                      {item.retencaoISS > 0 && <span>ISS: -{formatBRL(item.retencaoISS)}</span>}
                      {item.retencaoIRRF > 0 && <span>IRRF: -{formatBRL(item.retencaoIRRF)}</span>}
                      {item.retencaoISS === 0 && item.retencaoIRRF === 0 && <span className="text-on-surface-variant">Nenhuma</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-success">{formatBRL(item.valorPagar)}</td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="outline" size="sm" className="text-xs">
                      Gerar Pagamento
                    </Button>
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