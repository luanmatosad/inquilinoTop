'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createTicket } from '@/app/support/actions';

const ticketTypes = [
  { value: 'duvida', label: 'Dúvida' },
  { value: 'sugestao', label: 'Sugestão' },
  { value: 'reclamacao', label: 'Reclamação' },
  { value: 'outro', label: 'Outro' },
];

export default function NewTicketPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    tipo: '',
    asunto: '',
    descripcion: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.tipo) newErrors.tipo = 'Selecione o tipo de chamado';
    if (!formData.asunto.trim()) newErrors.asunto = 'Preencha o assunto';
    if (!formData.descripcion.trim()) newErrors.descripcion = 'Preencha a descrição';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    const result = await createTicket({
      tipo: formData.tipo,
      assunto: formData.asunto,
      descripcion: formData.descripcion,
    });

    setLoading(false);

    if (result.success) {
      router.push('/support/tickets');
    } else if (result.error) {
      setErrors({ submit: result.error });
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Abrir Novo Chamado</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.submit && (
              <div className="p-3 bg-error/10 border border-error rounded-lg text-error text-sm">
                {errors.submit}
              </div>
            )}

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
                value={formData.asunto}
                onChange={(e) => setFormData({ ...formData, asunto: e.target.value })}
                placeholder="Descreva brevemente o problema..."
                required
                className="w-full px-4 py-3 bg-surface border border-outline rounded-lg text-on-surface focus:ring-2 focus:ring-primary outline-none"
              />
              {errors.asunto && <p className="text-sm text-error mt-1">{errors.asunto}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Descrição</label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Detalhe máximo sua situação..."
                rows={6}
                required
                className="w-full px-4 py-3 bg-surface border border-outline rounded-lg text-on-surface focus:ring-2 focus:ring-primary outline-none resize-none"
              />
              {errors.descripcion && <p className="text-sm text-error mt-1">{errors.descripcion}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Chamado'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}