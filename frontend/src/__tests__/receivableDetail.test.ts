import { describe, it, expect } from 'vitest'
import {
  buildChargeMessage,
  buildTimeline,
  lateBreakdown,
  mailtoUrl,
  PAYMENT_METHOD_LABEL,
  type TimelineApiItem,
} from '@/lib/receivable-detail'
import { whatsappUrl } from '@/lib/whatsapp'

const base = {
  tenantName: 'Marina Souza',
  month: 'novembro',
  where: 'Ap 302 · Ed. Aurora',
  amount: 1850,
  dueLabel: '05/11',
  ownerFirstName: 'Luan',
}
const PIX = '00020126580014br.gov.bcb.pix0136123e4567'

describe('buildChargeMessage', () => {
  it('a vencer, com o Pix dentro do texto', () => {
    const m = buildChargeMessage({ ...base, late: false, pix: PIX })
    expect(m).toContain('Oi, Marina!')
    expect(m).toContain('aluguel de novembro (Ap 302 · Ed. Aurora)')
    expect(m).toContain('R$')
    expect(m).toContain('1.850,00')
    expect(m).toContain('vence em 05/11')
    expect(m).toContain(PIX)
    expect(m.trim().endsWith('— Luan')).toBe(true)
  })

  it('atrasada: texto de lembrete com o total atualizado', () => {
    const m = buildChargeMessage({ ...base, month: 'outubro', amount: 1585.13, dueLabel: '25/10', late: true, pix: PIX })
    expect(m).toContain('venceu em 25/10')
    expect(m).toContain('1.585,13')
    expect(m).toContain('multa e juros')
    expect(m).toContain(PIX)
  })

  it('sem Pix: o bloco do Pix some', () => {
    const m = buildChargeMessage({ ...base, late: false, pix: null })
    expect(m).not.toContain('Pix')
    expect(m).toContain('1.850,00')
  })

  it('sem nome do dono, sem assinatura quebrada', () => {
    const m = buildChargeMessage({ ...base, ownerFirstName: undefined, late: false, pix: null })
    expect(m).not.toContain('— undefined')
    expect(m).not.toMatch(/—\s*$/)
  })

  it('usa só o primeiro nome do inquilino', () => {
    expect(buildChargeMessage({ ...base, tenantName: 'Marina Souza Lima', late: false, pix: null })).toContain('Oi, Marina!')
  })
})

describe('links de envio', () => {
  it('wa.me com o texto codificado', () => {
    const url = whatsappUrl('(11) 98888-1111', 'Oi, Marina!\nPix: abc')
    expect(url).toBe('https://wa.me/5511988881111?text=' + encodeURIComponent('Oi, Marina!\nPix: abc'))
  })
  it('wa.me sem texto continua igual', () => {
    expect(whatsappUrl('11988881111')).toBe('https://wa.me/5511988881111')
  })
  it('mailto com assunto e corpo', () => {
    expect(mailtoUrl('marina@email.com', 'Aluguel de novembro', 'Oi!\nlinha 2')).toBe(
      'mailto:marina@email.com?subject=' + encodeURIComponent('Aluguel de novembro') + '&body=' + encodeURIComponent('Oi!\nlinha 2'),
    )
  })
  it('mailto sem e-mail: null', () => {
    expect(mailtoUrl(null, 'a', 'b')).toBeNull()
    expect(mailtoUrl('  ', 'a', 'b')).toBeNull()
  })
})

const U = 'user-1'
const at = (iso: string) => iso

describe('buildTimeline', () => {
  const items: TimelineApiItem[] = [
    { kind: 'CREATED', at: at('2026-10-01T03:00:00Z'), synthetic: true },
    { kind: 'SENT', at: at('2026-10-02T12:00:00Z'), channel: 'WHATSAPP', actor_id: U },
    { kind: 'OVERDUE', at: at('2026-10-25T00:00:00Z'), synthetic: true },
    { kind: 'REMINDER', at: at('2026-10-30T13:15:00Z'), channel: 'WHATSAPP', actor_id: 'outro' },
  ]
  const rows = buildTimeline(items, U)

  it('marco Criada', () => {
    expect(rows[0].title).toBe('Cobrança criada')
    expect(rows[0].detail).toBe('01/10 · gerada pelo contrato')
  })
  it('envio mostra canal, hora de São Paulo e "por você"', () => {
    expect(rows[1].title).toBe('Enviada por WhatsApp')
    expect(rows[1].detail).toBe('02/10, 09:00 · por você')
  })
  it('venceu em', () => {
    expect(rows[2].title).toBe('Venceu em 25/10')
    expect(rows[2].detail).toBe('Sem pagamento informado')
  })
  it('lembrete de outro membro', () => {
    expect(rows[3].title).toBe('Lembrete enviado')
    expect(rows[3].detail).toBe('30/10, 10:15 · por um membro da equipe')
  })
  it('acordo', () => {
    const [r] = buildTimeline(
      [{ kind: 'AGREEMENT', at: '2026-11-07T15:00:00Z', actor_id: U, data: { old_due_date: '2026-10-25', new_due_date: '2026-11-12', old_amount: 1550, new_amount: 1585.13, note: 'WhatsApp' } }],
      U,
    )
    expect(r.title).toBe('Acordo de atraso')
    expect(r.detail).toContain('nova data 12/11')
    expect(r.detail).toContain('1.585,13')
    expect(r.detail).toContain('WhatsApp')
    expect(r.detail).toContain('por você')
  })
  it('pagamento com forma', () => {
    const [r] = buildTimeline(
      [{ kind: 'PAID', at: '2026-11-02T15:00:00Z', actor_id: U, data: { amount: 1850, method: 'PIX', discount: 0, paid_date: '2026-11-02' } }],
      U,
    )
    expect(r.title).toBe('Pagamento registrado')
    expect(r.detail).toContain('02/11')
    expect(r.detail).toContain('1.850,00')
    expect(r.detail).toContain('Pix')
  })
  it('cópia da mensagem', () => {
    const [r] = buildTimeline([{ kind: 'SENT', at: '2026-10-02T12:00:00Z', channel: 'COPY', actor_id: U }], U)
    expect(r.title).toBe('Mensagem copiada')
  })
  it('formas de pagamento', () => {
    expect(PAYMENT_METHOD_LABEL).toMatchObject({ PIX: 'Pix', CASH: 'Dinheiro', TRANSFER: 'Transferência', BOLETO: 'Boleto', OTHER: 'Outro' })
  })
})

describe('lateBreakdown', () => {
  const now = new Date('2026-11-07T15:00:00Z')
  it('decompõe como no canvas', () => {
    const b = lateBreakdown({ gross: 1550, lateFee: 31, interest: 4.13, dueDate: '2026-10-30T00:00:00Z', lateFeePercent: 2, monthlyInterestPercent: 1, now })
    expect(b.daysLate).toBe(8)
    expect(b.lines.map((l) => l.label)).toEqual(['Aluguel', 'Multa (2%)', 'Juros (1% ao mês · 8 dias)'])
    expect(b.total).toBe(1585.13)
  })
  it('em dia: zero dias e total igual ao bruto', () => {
    const b = lateBreakdown({ gross: 1550, lateFee: 0, interest: 0, dueDate: '2026-11-20T00:00:00Z', lateFeePercent: 2, monthlyInterestPercent: 1, now })
    expect(b.daysLate).toBe(0)
    expect(b.total).toBe(1550)
  })
  it('um dia de atraso no singular', () => {
    const b = lateBreakdown({ gross: 100, lateFee: 2, interest: 0.03, dueDate: '2026-11-06T00:00:00Z', lateFeePercent: 2, monthlyInterestPercent: 1, now })
    expect(b.daysLate).toBe(1)
    expect(b.lines[2].label).toBe('Juros (1% ao mês · 1 dia)')
  })
})
