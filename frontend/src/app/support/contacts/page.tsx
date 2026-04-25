'use client';

import { MessageCircle, Mail, Phone, Clock } from 'lucide-react';

const contacts = [
  {
    id: 'whatsapp',
    icon: MessageCircle,
    title: 'Fale pelo WhatsApp',
    description: 'Responderemos rapidamente',
    action: 'Entrar em contato',
    color: 'text-[#25D366]',
    bgColor: 'bg-[#25D366]/10',
  },
  {
    id: 'email',
    icon: Mail,
    title: 'Envie um email',
    description: 'suporte@inquilino.com.br',
    action: 'Enviar email',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    id: 'phone',
    icon: Phone,
    title: 'Ligue para nós',
    description: '(11) 4000-0000',
    action: 'Ligar',
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
  },
  {
    id: 'hours',
    icon: Clock,
    title: 'Horário de atendimento',
    description: 'Seg. a Sex. das 9h às 18h',
    action: null,
    color: 'text-on-surface-variant',
    bgColor: 'bg-surface-variant',
  },
];

export default function ContactsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-on-surface">Contatos</h1>
        <p className="text-on-surface-variant mt-2">Escolha a melhor forma de nos contactar</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {contacts.map((contact) => {
          const IconComponent = contact.icon;
          return (
            <div
              key={contact.id}
              className="bg-surface p-6 rounded-xl border border-outline hover:border-primary hover:shadow-md transition-all duration-200"
            >
              <div className={`w-12 h-12 ${contact.bgColor} rounded-lg flex items-center justify-center mb-4`}>
                <IconComponent className={`w-6 h-6 ${contact.color}`} />
              </div>
              <h3 className="text-lg font-semibold text-on-surface">{contact.title}</h3>
              <p className="text-sm text-on-surface-variant mt-1">{contact.description}</p>
              {contact.action && (
                <span className="mt-4 text-sm font-medium text-primary">
                  {contact.action}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}