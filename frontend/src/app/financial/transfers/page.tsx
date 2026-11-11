'use client'

import React, { useState, useEffect, useCallback } from 'react';
import {
  getTransfers,
  getAdminFee,
  setAdminFee,
  generateTransfers,
  updateTransferStatus,
  updateTransferDiscounts,
  Transfer,
} from '../actions';
import { Search, RefreshCw, FileText, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const NEXT_STATUS: Record<Transfer['status'], Transfer['status'] | null> = {
  PENDING: 'PROCESSED',
  PROCESSED: 'TRANSFERRED',
  TRANSFERRED: null,
};

const NEXT_LABEL: Record<Transfer['status'], string> = {
  PENDING: 'Marcar como processado',
  PROCESSED: 'Aprovar e transferir',
  TRANSFERRED: 'Transferido',
};

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function RepassesProprietarios() {
  const [data, setData] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepasse, setSelectedRepasse] = useState<Transfer | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [adminFeeInput, setAdminFeeInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');

  const loadTransfers = useCallback(async () => {
    setData(await getTransfers());
    setLoading(false);
  }, []);

  useEffect(() => {
    getTransfers().then(list => {
      setData(list);
      setLoading(false);
    });
    getAdminFee().then(pct => setAdminFeeInput(String(pct)));
  }, []);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const filtered = data.filter(item =>
    item.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.propertyName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openRepasse = (item: Transfer) => {
    setSelectedRepasse(item);
    setDiscountInput(String(item.discounts));
  };

  const handleGenerate = async () => {
    setBusy(true);
    setMessage(null);
    const period = currentPeriod();
    const res = await generateTransfers(period);
    setBusy(false);
    if ('error' in res) {
      setMessage(res.error);
      return;
    }
    setMessage(`${res.created} repasse(s) gerado(s) para ${period}.`);
    await loadTransfers();
  };

  const handleAdvance = async (item: Transfer) => {
    const next = NEXT_STATUS[item.status];
    if (!next) return;
    setBusy(true);
    setMessage(null);
    const res = await updateTransferStatus(item.id, next);
    setBusy(false);
    if ('error' in res) {
      setMessage(res.error);
      return;
    }
    setSelectedRepasse(null);
    await loadTransfers();
  };

  const handleSaveDiscounts = async (item: Transfer) => {
    const value = Number(discountInput);
    if (!Number.isFinite(value)) {
      setMessage('Informe um valor de desconto válido.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await updateTransferDiscounts(item.id, value);
    setBusy(false);
    if ('error' in res) {
      setMessage(res.error);
      return;
    }
    setSelectedRepasse(null);
    await loadTransfers();
  };

  const handleSaveAdminFee = async () => {
    const pct = Number(adminFeeInput);
    if (!Number.isFinite(pct)) {
      setMessage('Informe uma taxa administrativa válida.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await setAdminFee(pct);
    setBusy(false);
    setMessage('error' in res ? res.error : 'Taxa administrativa salva.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Repasses a Proprietários</h1>
          <p className="text-muted-foreground">Gerenciamento de pagamentos líquidos aos donos dos imóveis</p>
        </div>
        <Button className="flex items-center gap-2" onClick={handleGenerate} disabled={busy}>
          <RefreshCw className="w-4 h-4" /> Processar Repasses do Mês
        </Button>
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <div className="bg-background p-4 rounded-lg border border-border shadow-sm w-full sm:w-96 relative">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar proprietário ou imóvel..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-muted border border-input rounded-md focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

      <div className="bg-background p-4 rounded-lg border border-border shadow-sm w-full sm:w-96 flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
          Taxa administrativa (%)
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={adminFeeInput}
            onChange={(e) => setAdminFeeInput(e.target.value)}
            className="w-32 px-3 py-2 text-sm bg-muted border border-input rounded-md focus:ring-2 focus:ring-primary outline-none"
          />
        </label>
        <Button variant="outline" onClick={handleSaveAdminFee} disabled={busy}>Salvar taxa</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground uppercase text-xs">
              <tr>
                <th className="px-6 py-3 font-medium">Proprietário</th>
                <th className="px-6 py-3 font-medium">Imóvel</th>
                <th className="px-6 py-3 font-medium">Rec. Bruto</th>
                <th className="px-6 py-3 font-medium">Taxa ADM</th>
                <th className="px-6 py-3 font-medium">Descontos</th>
                <th className="px-6 py-3 font-medium text-green-700 dark:text-green-400">Valor Líquido</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">Nenhum repasse encontrado.</td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="hover:bg-muted transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{item.ownerName}</td>
                  <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate" title={item.propertyName}>{item.propertyName}</td>
                  <td className="px-6 py-4">{formatBRL(item.grossAmount)}</td>
                  <td className="px-6 py-4 text-error">-{formatBRL(item.adminFeeAmount)} ({item.adminFeePercent}%)</td>
                  <td className="px-6 py-4 text-error">-{formatBRL(item.discounts)}</td>
                  <td className="px-6 py-4 font-bold text-success">{formatBRL(item.netAmount)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      item.status === 'TRANSFERRED' ? 'bg-success/10 text-success' :
                      item.status === 'PROCESSED' ? 'bg-primary/10 text-primary' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => openRepasse(item)} className="text-xs">
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
          <div className="bg-background rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-card">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">Extrato de Repasse</h2>
              </div>
              <button onClick={() => setSelectedRepasse(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="p-6">
              <div className="mb-6 pb-4 border-b border-border">
                <p className="text-sm font-medium text-muted-foreground">Proprietário</p>
                <p className="text-lg font-bold">{selectedRepasse.ownerName}</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedRepasse.propertyName} · {selectedRepasse.period}</p>
              </div>

              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between text-success">
                  <span>(+) Valor Recebido</span>
                  <span>{formatBRL(selectedRepasse.grossAmount)}</span>
                </div>
                <div className="flex justify-between text-error">
                  <span>(-) Taxa ADM ({selectedRepasse.adminFeePercent}%)</span>
                  <span>{formatBRL(selectedRepasse.adminFeeAmount)}</span>
                </div>
                {selectedRepasse.status === 'PENDING' ? (
                  <div className="flex items-end justify-between gap-2 text-error">
                    <label className="flex flex-col gap-1">
                      (-) Descontos (R$)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        className="w-32 px-2 py-1 text-sm bg-muted border border-input rounded-md outline-none"
                      />
                    </label>
                    <Button variant="outline" size="sm" onClick={() => handleSaveDiscounts(selectedRepasse)} disabled={busy}>
                      Salvar descontos
                    </Button>
                  </div>
                ) : selectedRepasse.discounts > 0 && (
                  <div className="flex justify-between text-error">
                    <span>(-) Descontos (Retenções/Taxas)</span>
                    <span>{formatBRL(selectedRepasse.discounts)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-dashed border-border flex justify-between font-bold text-base mt-2">
                  <span>(=) Total a Repassar</span>
                  <span className="text-success">{formatBRL(selectedRepasse.netAmount)}</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border bg-card flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedRepasse(null)}>Fechar</Button>
              <Button
                onClick={() => handleAdvance(selectedRepasse)}
                disabled={busy || !NEXT_STATUS[selectedRepasse.status]}
                className="gap-2"
              >
                <Send className="w-4 h-4" /> {NEXT_LABEL[selectedRepasse.status]}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
