'use client';

import Link from 'next/link';
import { Search, Wallet, FileText, Smartphone, MoreHorizontal, MessageCircle } from 'lucide-react';

const categories = [
  { id: 'financeiro', label: 'Financeiro', icon: Wallet, description: 'Dúvidas sobre pagamentos e finanças' },
  { id: 'contratos', label: 'Contratos', icon: FileText, description: 'Perguntas sobre contratos de aluguel' },
  { id: 'app', label: 'App', icon: Smartphone, description: 'Problemas com o aplicativo móvel' },
  { id: 'outros', label: 'Outros', icon: MoreHorizontal, description: 'Outras dúvidas e suporte' },
];

export default function SupportCentral() {
  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Central de Suporte</h1>
        <p className="text-on-surface-variant mt-2">Como podemos ajudar você hoje?</p>
      </div>

      <div className="max-w-xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar artigos..."
            className="w-full pl-12 pr-4 py-4 bg-surface border border-outline rounded-xl text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all text-lg"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => {
          const IconComponent = category.icon;
          return (
            <Link
              key={category.id}
              href="#"
              className="group bg-surface p-6 rounded-xl border border-outline hover:border-primary hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer"
            >
              <IconComponent className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold text-on-surface">{category.label}</h3>
              <p className="text-sm text-on-surface-variant mt-1">{category.description}</p>
            </Link>
          );
        })}
      </div>

      <div className="bg-surface p-6 rounded-xl border border-outline">
        <h2 className="text-lg font-semibold text-on-surface mb-4">Artigos Recentes</h2>
        <div className="space-y-3">
          {[
            'Como alterar a data de vencimento do aluguel?',
            'Documentos necessários para locação',
            'Como usar o aplicativo InquilinoTop',
            'Entendendo as taxas do contrato',
          ].map((article, i) => (
            <button
              key={i}
              disabled
              className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container transition-colors group w-full text-left cursor-not-allowed opacity-60"
            >
              <span className="text-on-surface group-hover:text-primary transition-colors">{article}</span>
              <MessageCircle className="w-4 h-4 text-on-surface-variant" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}