'use client'

import React, { useState, useEffect, useRef } from 'react';
import {
  getBankRecords,
  getReceivables,
  getPayables,
  importBankRecords,
  BankRecord,
  Receivable,
  Payable,
} from '../actions';
import { Upload, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface SystemRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'RECEBER' | 'PAGAR';
}

export default function ConciliacaoBancaria() {
  const [bankRecords, setBankRecords] = useState<BankRecord[]>([]);
  const [systemRecords, setSystemRecords] = useState<SystemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([getBankRecords(), getReceivables(), getPayables()]).then(
      ([banks, recs, pags]: [BankRecord[], Receivable[], Payable[]]) => {
        setBankRecords(banks);
        setSystemRecords([
          ...recs
            .filter(r => r.status === 'PENDING')
            .map(r => ({ id: r.id, date: r.dueDate, description: r.payer, amount: r.amount, type: 'RECEBER' as const })),
          ...pags
            .filter(p => p.status === 'PENDING')
            .map(p => ({ id: p.id, date: p.dueDate, description: p.supplier, amount: p.amount, type: 'PAGAR' as const })),
        ]);
        setLoading(false);
      }
    );
  }, []);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  };

  const applyDateFilter = async (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    setBankRecords(await getBankRecords({ from: nextFrom || undefined, to: nextTo || undefined }));
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setMessage(null);
    const formData = new FormData();
    formData.append('file', file);
    const res = await importBankRecords(formData);
    setImporting(false);
    if ('error' in res) {
      setMessage(res.error);
      return;
    }
    setMessage(
      `Importados: ${res.imported} · Já existentes: ${res.duplicate} · Conciliados: ${res.matched} · Não conciliados: ${res.unmatched}`
    );
    await applyDateFilter(from, to);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Conciliação Bancária</h1>
          <p className="text-muted-foreground">Importação de extrato em CSV (date, description, amount, type) e conciliação automática de recebimentos</p>
        </div>
        <Button
          className="flex items-center gap-2"
          disabled={importing}
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="w-4 h-4" /> {importing ? 'Importando...' : 'Importar Arquivo'}
        </Button>
        <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-lg">Extrato Bancário</CardTitle>
            <div className="flex flex-wrap gap-3 mt-3 text-sm">
              <label className="flex items-center gap-1">
                De
                <input
                  type="date"
                  value={from}
                  onChange={e => void applyDateFilter(e.target.value, to)}
                  className="px-2 py-1 bg-muted border border-input rounded-md outline-none"
                />
              </label>
              <label className="flex items-center gap-1">
                Até
                <input
                  type="date"
                  value={to}
                  onChange={e => void applyDateFilter(from, e.target.value)}
                  className="px-2 py-1 bg-muted border border-input rounded-md outline-none"
                />
              </label>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px]">
            <ul className="divide-y divide-border">
              {loading ? (
                <li className="p-6 text-center text-muted-foreground">Carregando...</li>
              ) : bankRecords.length === 0 ? (
                <li className="p-6 text-center text-muted-foreground">Nenhum lançamento importado.</li>
              ) : bankRecords.map(br => {
                const conciliated = br.paymentId !== null;
                return (
                  <li key={br.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{br.description}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(br.date)}</p>
                      </div>
                      <span className={`font-bold text-sm ${br.type === 'CREDIT' ? 'text-success' : 'text-error'}`}>
                        {br.type === 'CREDIT' ? '+' : '-'}{formatBRL(br.amount)}
                      </span>
                    </div>
                    {conciliated ? (
                      <div className="mt-2 text-xs font-medium text-success flex items-center gap-1">
                        <Check className="w-3 h-3" /> Conciliado com recebimento
                      </div>
                    ) : (
                      <div className={`mt-2 text-xs flex items-center gap-1 ${br.type === 'CREDIT' ? 'text-warning' : 'text-muted-foreground'}`}>
                        {br.type === 'CREDIT' && <AlertTriangle className="w-3 h-3" />}
                        {br.type === 'CREDIT'
                          ? 'Não conciliado: revisar manualmente.'
                          : 'Débito: não concilia com recebimentos.'}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-lg">Lançamentos Pendentes no Sistema</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px]">
            <ul className="divide-y divide-border">
              {loading ? (
                <li className="p-6 text-center text-muted-foreground">Carregando...</li>
              ) : systemRecords.length === 0 ? (
                <li className="p-6 text-center text-muted-foreground">Nenhum lançamento pendente.</li>
              ) : systemRecords.map(sr => (
                <li key={sr.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{sr.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(sr.date)} · {sr.type === 'RECEBER' ? 'A receber' : 'A pagar'}</p>
                    </div>
                    <span className="font-bold text-sm text-foreground">{formatBRL(sr.amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
