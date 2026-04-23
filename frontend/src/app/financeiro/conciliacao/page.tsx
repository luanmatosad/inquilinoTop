'use client'

import React, { useState, useEffect } from 'react';
import { getBankRecords, getRecebimentos, getPagamentos, BankRecord, Recebimento, Pagamento } from '@/data/financeiro/dal';
import { Upload, Link2, AlertTriangle, Check, FileDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface SystemRecord {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: 'Recebimento' | 'Pagamento';
}

export default function ConciliacaoBancaria() {
  const [bankRecords, setBankRecords] = useState<BankRecord[]>([]);
  const [systemRecords, setSystemRecords] = useState<SystemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [conciliatedIds, setConciliatedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([getBankRecords(), getRecebimentos(), getPagamentos()]).then(([banks, recs, pags]) => {
      setBankRecords(banks);
      
      const sys: SystemRecord[] = [
        ...recs.filter(r => r.status !== 'Pago').map(r => ({
          id: `r-${r.id}`,
          data: r.vencimento,
          descricao: `Cobrança: ${r.pagador} (${r.imovel})`,
          valor: r.valor,
          tipo: 'Recebimento' as const
        })),
        ...pags.filter(p => p.status !== 'Pago').map(p => ({
          id: `p-${p.id}`,
          data: p.vencimento,
          descricao: `Despesa: ${p.fornecedor} (${p.categoria})`,
          valor: -p.valor,
          tipo: 'Pagamento' as const
        }))
      ];
      setSystemRecords(sys);
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

  const handleConciliate = (bankId: string) => {
    const newSet = new Set(conciliatedIds);
    newSet.add(bankId);
    setConciliatedIds(newSet);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Conciliação Bancária</h1>
          <p className="text-on-surface-variant">Importação e sincronização de extrato (OFX/CNAB)</p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> Importar Arquivo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Extrato do Banco */}
        <Card className="flex flex-col h-[700px]">
          <CardHeader className="border-b border-outline-variant bg-surface-variant/50 pb-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileDown className="w-5 h-5 text-primary" />
                Extrato Bancário
              </CardTitle>
              <span className="text-sm font-medium bg-surface px-2 py-1 rounded-md shadow-sm border border-outline">
                Saldo: {formatBRL(12450.00)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {loading ? (
              <div className="p-8 text-center text-on-surface-variant">Carregando extrato...</div>
            ) : bankRecords.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant">Nenhum registro bancário encontrado. Importe um extrato.</div>
            ) : (
              <ul className="divide-y divide-outline-variant">
                {bankRecords.map(br => {
                  const isConciliated = conciliatedIds.has(br.id);
                  // Find a potential match in system
                  const match = systemRecords.find(sr => sr.valor === br.valor && !isConciliated);
                  
                  return (
                    <li key={br.id} className={`p-4 transition-all ${isConciliated ? 'opacity-40 bg-surface-container-lowest' : 'hover:bg-surface-container-low'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs font-medium text-on-surface-variant">{formatDate(br.data)}</span>
                          <p className="text-sm font-medium text-on-surface mt-1">{br.descricao}</p>
                        </div>
                        <div className={`text-sm font-bold ${br.valor > 0 ? 'text-success' : 'text-on-surface'}`}>
                          {br.valor > 0 ? '+' : ''}{formatBRL(br.valor)}
                        </div>
                      </div>

                      {!isConciliated && (
                        <div className="mt-3 flex items-center justify-between p-3 bg-surface-container rounded-md border border-outline-variant">
                          {match ? (
                            <div className="flex items-center gap-2 text-sm text-on-surface">
                              <Link2 className="w-4 h-4 text-success" />
                              <span className="font-medium text-success">Sugestão:</span>
                              <span className="truncate max-w-[200px]">{match.descricao}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-warning">
                              <AlertTriangle className="w-4 h-4" />
                              <span>Nenhuma correspondência exata encontrada.</span>
                            </div>
                          )}
                          <Button 
                            size="sm" 
                            variant={match ? 'default' : 'outline'}
                            className={match ? 'bg-success hover:bg-success/90 text-white' : ''}
                            onClick={() => handleConciliate(br.id)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            {match ? 'Confirmar' : 'Vincular'}
                          </Button>
                        </div>
                      )}
                      {isConciliated && (
                        <div className="mt-2 text-xs font-medium text-success flex items-center gap-1">
                          <Check className="w-3 h-3" /> Conciliado com sucesso
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Right Side: Sistema */}
        <Card className="flex flex-col h-[700px]">
          <CardHeader className="border-b border-outline-variant bg-surface-variant/50 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              Registros do Sistema
            </CardTitle>
            <p className="text-xs text-on-surface-variant mt-1">Títulos pendentes no InquilinoTop</p>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {loading ? (
              <div className="p-8 text-center text-on-surface-variant">Buscando títulos...</div>
            ) : (
              <ul className="divide-y divide-outline-variant">
                {systemRecords.map(sr => (
                  <li key={sr.id} className="p-4 hover:bg-surface-container-low flex justify-between items-center group cursor-pointer transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider ${sr.tipo === 'Recebimento' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                          {sr.tipo}
                        </span>
                        <span className="text-xs font-medium text-on-surface-variant">{formatDate(sr.data)}</span>
                      </div>
                      <p className="text-sm font-medium text-on-surface mt-2">{sr.descricao}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${sr.valor > 0 ? 'text-success' : 'text-on-surface'}`}>
                        {formatBRL(Math.abs(sr.valor))}
                      </div>
                      <button className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                        Selecionar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}