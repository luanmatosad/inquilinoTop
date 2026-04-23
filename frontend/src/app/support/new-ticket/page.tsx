'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const ticketTypes = [
  { value: 'duvida', label: 'Dúvida' },
  { value: 'sugestao', label: 'Sugestão' },
  { value: 'reclamacao', label: 'Reclamação' },
  { value: 'outro', label: 'Outro' },
];

export default function NewTicketPage() {
  const [formData, setFormData] = useState({
    tipo: '',
    assunto: '',
    descricao: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.tipo) newErrors.tipo = 'Selecione o tipo de chamado';
    if (!formData.assunto.trim()) newErrors.assunto = 'Preencha o assunto';
    if (!formData.descricao.trim()) newErrors.descricao = 'Preencha a descrição';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto">
        <Card>
          <CardContent className="pt-12 pb-8 text-center">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-on-surface">Chamado enviado!</h2>
            <p className="text-on-surface-variant mt-2">Nossa equipe responderá em até 24 horas.</p>
            <Button onClick={() => setSubmitted(false)} className="mt-6">
              Enviar outro chamado
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Abrir Novo Chamado</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Tipo</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                required
                className="w-full px-4 py-3 bg-surface border border-outline rounded-lg text-on-surface focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">Selecione o tipo...</option>
                {ticketTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              {errors.tipo && <p className="text-sm text-error mt-1">{errors.tipo}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Assunto</label>
              <input
                type="text"
                value={formData.assunto}
                onChange={(e) => setFormData({ ...formData, assunto: e.target.value })}
                placeholder="Descreva brevemente o problema..."
                required
                className="w-full px-4 py-3 bg-surface border border-outline rounded-lg text-on-surface focus:ring-2 focus:ring-primary outline-none"
              />
              {errors.assunto && <p className="text-sm text-error mt-1">{errors.assunto}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Descrição</label>
              <textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Detalhe máximo sua situação..."
                rows={6}
                required
                className="w-full px-4 py-3 bg-surface border border-outline rounded-lg text-on-surface focus:ring-2 focus:ring-primary outline-none resize-none"
              />
              {errors.descricao && <p className="text-sm text-error mt-1">{errors.descricao}</p>}
            </div>

            <Button type="submit" className="w-full">
              Enviar Chamado
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}