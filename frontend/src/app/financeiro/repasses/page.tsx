'use client'

import React, { useState, useEffect } from 'react';
import { getRepasses, Repasse } from '@/data/financeiro/dal';
import { Search, RefreshCw, FileText, Send } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function RepassesProprietarios() {
  const [data, setData] = useState<Repasse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepasse, setSelectedRepasse] = useState<Repasse | null>(null);

  useEffect(() => {
    getRepasses().then(res => {
      setData(res);
      setLoading(false);
    });
  }, []);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const filtered = data.filter(item => 
    item.proprietario.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.imoveis.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Repasses a Proprietários</h1>
          <p className="text-on-surface-variant">Gerenciamento de pagamentos líquidos aos donos dos imóveis</p>
        </div>
        <Button className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Processar Repasses do Mês
        </Button>
      </div>

      <div className="bg-surface p-4 rounded-lg border border-outline-variant shadow-sm w-full sm:w-96 relative">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
        <input 
          type="text" 
          placeholder="Buscar proprietário ou imóvel..." 
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
                <th className="px-6 py-3 font-medium">Proprietário</th>
                <th className="px-6 py-3 font-medium">Imóveis</th>
                <th className="px-6 py-3 font-medium">Rec. Bruto</th>
                <th className="px-6 py-3 font-medium">Taxa ADM</th>
                <th className="px-6 py-3 font-medium">Descontos</th>
                <th className="px-6 py-3 font-medium text-success">Valor Líquido</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-on-surface-variant">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-on-surface-variant">Nenhum repasse encontrado.</td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4 font-medium text-on-surface">{item.proprietario}</td>
                  <td className="px-6 py-4 text-on-surface-variant max-w-[200px] truncate" title={item.imoveis}>{item.imoveis}</td>
                  <td className="px-6 py-4">{formatBRL(item.recebimentoBruto)}</td>
                  <td className="px-6 py-4 text-error">-{formatBRL(item.taxaAdmValor)} ({item.taxaAdmPerc}%)</td>
                  <td className="px-6 py-4 text-error">-{formatBRL(item.descontos)}</td>
                  <td className="px-6 py-4 font-bold text-success">{formatBRL(item.valorLiquido)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      item.status === 'Transferido' ? 'bg-success/10 text-success' :
                      item.status === 'Processado' ? 'bg-primary/10 text-primary' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedRepasse(item)} className="text-xs">
                      Ver Extrato
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Ver Extrato */}
      {selectedRepasse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">Extrato de Repasse</h2>
              </div>
              <button onClick={() => setSelectedRepasse(null)} className="text-on-surface-variant hover:text-on-surface">✕</button>
            </div>
            
            <div className="p-6">
              <div className="mb-6 pb-4 border-b border-outline-variant">
                <p className="text-sm font-medium text-on-surface-variant">Proprietário</p>
                <p className="text-lg font-bold">{selectedRepasse.proprietario}</p>
                <p className="text-sm text-on-surface-variant mt-1">{selectedRepasse.imoveis}</p>
              </div>

              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between text-success">
                  <span>(+) Valor Recebido</span>
                  <span>{formatBRL(selectedRepasse.recebimentoBruto)}</span>
                </div>
                <div className="flex justify-between text-error">
                  <span>(-) Taxa ADM ({selectedRepasse.taxaAdmPerc}%)</span>
                  <span>{formatBRL(selectedRepasse.taxaAdmValor)}</span>
                </div>
                {selectedRepasse.descontos > 0 && (
                  <div className="flex justify-between text-error">
                    <span>(-) Descontos (Retenções/Taxas)</span>
                    <span>{formatBRL(selectedRepasse.descontos)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-dashed border-outline-variant flex justify-between font-bold text-base mt-2">
                  <span>(=) Total a Repassar</span>
                  <span className="text-success">{formatBRL(selectedRepasse.valorLiquido)}</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedRepasse(null)}>Fechar</Button>
              <Button onClick={() => setSelectedRepasse(null)} disabled={selectedRepasse.status === 'Transferido'} className="gap-2">
                <Send className="w-4 h-4" /> Aprovar e Transferir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}