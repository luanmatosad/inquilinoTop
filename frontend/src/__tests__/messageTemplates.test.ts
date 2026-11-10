import { describe, it, expect } from 'vitest'
import {
  REMINDER_VARIABLES,
  renderTemplate,
  chargeVariables,
  pickReminder,
  daysFromDue,
  offsetLabel,
  validateReminders,
  insertAtCursor,
  SAMPLE_VARIABLES,
  type Reminder,
} from '@/lib/message-templates'

const norm = (s: string) => s.replace(/ /g, ' ')

describe('renderTemplate', () => {
  it('troca as variáveis conhecidas', () => {
    expect(renderTemplate('Oi, {nome}! {valor} em {vencimento} ({imóvel}, {mês}).', { nome: 'Marina', valor: 'R$ 10,00', vencimento: '05/11', imóvel: 'Ap 302', mês: 'novembro' })).toBe(
      'Oi, Marina! R$ 10,00 em 05/11 (Ap 302, novembro).',
    )
  })
  it('variável repetida e desconhecida', () => {
    expect(renderTemplate('{nome} {nome} {xyz}', { nome: 'Ana' })).toBe('Ana Ana {xyz}')
  })
  it('variável vazia some sem deixar espaço sobrando nem linhas em branco demais', () => {
    expect(renderTemplate('Pague: {link}\n\n\n\nFim {pix}', { link: '', pix: '' })).toBe('Pague:\n\nFim')
  })
  it('não interpreta chaves dentro do valor (sem recursão)', () => {
    expect(renderTemplate('{nome}', { nome: '{valor}', valor: 'x' })).toBe('{valor}')
  })
})

describe('chargeVariables', () => {
  const base = { tenantName: 'Marina Souza', month: 'novembro', where: 'Ap 302 · Ed. Aurora', amount: 1850, dueLabel: '05/11', pix: 'PIXCODE', link: null as string | null }
  it('primeiro nome, valor, vencimento, imóvel e mês', () => {
    const v = chargeVariables(base)
    expect(v.nome).toBe('Marina')
    expect(norm(v.valor)).toBe('R$ 1.850,00')
    expect(v.vencimento).toBe('05/11')
    expect(v['imóvel']).toBe('Ap 302 · Ed. Aurora')
    expect(v['mês']).toBe('novembro')
  })
  it('{link} é o link se existe; senão o Pix; senão vazio', () => {
    expect(chargeVariables({ ...base, link: 'https://x/p/abc' }).link).toBe('https://x/p/abc')
    expect(chargeVariables(base).link).toBe('PIXCODE')
    expect(chargeVariables({ ...base, pix: null }).link).toBe('')
  })
  it('{pix} é sempre o código (vazio se não há)', () => {
    expect(chargeVariables({ ...base, link: 'https://x' }).pix).toBe('PIXCODE')
    expect(chargeVariables({ ...base, pix: null }).pix).toBe('')
  })
})

const r = (name: string, offset_days: number): Reminder => ({ name, offset_days, body: 'x' })
const list = [r('Gentil', -3), r('No dia', 0), r('Atraso', 3), r('Firme', 10)]

describe('pickReminder (maior dia menor ou igual; senão o primeiro)', () => {
  it('antes do primeiro lembrete: o primeiro', () => {
    expect(pickReminder(list, -5)?.name).toBe('Gentil')
  })
  it('exatamente em cada dia', () => {
    expect(pickReminder(list, -3)?.name).toBe('Gentil')
    expect(pickReminder(list, 0)?.name).toBe('No dia')
    expect(pickReminder(list, 3)?.name).toBe('Atraso')
    expect(pickReminder(list, 10)?.name).toBe('Firme')
  })
  it('entre dois lembretes vale o anterior', () => {
    expect(pickReminder(list, -1)?.name).toBe('Gentil')
    expect(pickReminder(list, 2)?.name).toBe('No dia')
    expect(pickReminder(list, 6)?.name).toBe('Atraso')
    expect(pickReminder(list, 45)?.name).toBe('Firme')
  })
  it('não depende da ordem da lista', () => {
    expect(pickReminder([...list].reverse(), 4)?.name).toBe('Atraso')
  })
  it('lista vazia: nenhum', () => {
    expect(pickReminder([], 0)).toBeNull()
    expect(pickReminder(null, 0)).toBeNull()
  })
})

describe('daysFromDue', () => {
  it('negativo antes de vencer, positivo depois', () => {
    expect(daysFromDue('2026-11-05', '2026-11-02')).toBe(-3)
    expect(daysFromDue('2026-11-05', '2026-11-05')).toBe(0)
    expect(daysFromDue('2026-11-05T00:00:00Z', '2026-11-09')).toBe(4)
    expect(daysFromDue('2026-12-30', '2027-01-02')).toBe(3)
  })
})

describe('offsetLabel', () => {
  it('rótulos como no canvas', () => {
    expect(offsetLabel(-3)).toBe('3 dias antes do vencimento')
    expect(offsetLabel(-1)).toBe('1 dia antes do vencimento')
    expect(offsetLabel(0)).toBe('No dia do vencimento')
    expect(offsetLabel(1)).toBe('1 dia depois')
    expect(offsetLabel(10)).toBe('10 dias depois')
  })
})

describe('validateReminders (espelha o backend)', () => {
  const ok: Reminder = { name: 'Gentil', offset_days: -3, body: 'Oi {nome}! {link}' }
  it('lista válida', () => expect(validateReminders([ok])).toBeNull())
  it('mensagens', () => {
    expect(validateReminders([])).toBe('Informe de 1 a 8 lembretes.')
    expect(validateReminders(Array.from({ length: 9 }, (_, i) => ({ ...ok, offset_days: i })))).toBe('Informe de 1 a 8 lembretes.')
    expect(validateReminders([{ ...ok, name: ' ' }])).toBe('O nome do lembrete vai de 1 a 40 caracteres.')
    expect(validateReminders([{ ...ok, offset_days: 61 }])).toBe('Os dias vão de -30 a 60 em relação ao vencimento.')
    expect(validateReminders([ok, { ...ok, name: 'Outro' }])).toBe('Dois lembretes não podem ter os mesmos dias (-3).')
    expect(validateReminders([{ ...ok, body: '  ' }])).toBe('O texto vai de 1 a 1000 caracteres.')
    expect(validateReminders([{ ...ok, body: 'x'.repeat(1001) }])).toBe('O texto vai de 1 a 1000 caracteres.')
    expect(validateReminders([{ ...ok, body: 'Oi {nom}' }])).toBe('Variável desconhecida: {nom}.')
  })
  it('chave sem fechar é texto comum; letras não bytes', () => {
    expect(validateReminders([{ ...ok, body: 'Valor {valor e mais' }])).toBeNull()
    expect(validateReminders([{ ...ok, name: 'ç'.repeat(40), body: 'ã'.repeat(1000) }])).toBeNull()
  })
})

describe('insertAtCursor', () => {
  it('insere no cursor e devolve a nova posição', () => {
    expect(insertAtCursor('Oi, !', 4, 4, '{nome}')).toEqual({ text: 'Oi, {nome}!', cursor: 10 })
  })
  it('substitui a seleção', () => {
    expect(insertAtCursor('Oi XXXX!', 3, 7, '{nome}')).toEqual({ text: 'Oi {nome}!', cursor: 9 })
  })
  it('sem cursor conhecido, vai para o fim', () => {
    expect(insertAtCursor('Oi', null, null, '{valor}')).toEqual({ text: 'Oi{valor}', cursor: 9 })
  })
})

describe('constantes', () => {
  it('as variáveis do canvas e o link', () => {
    expect(REMINDER_VARIABLES.map((v) => v.token)).toEqual(['{nome}', '{valor}', '{vencimento}', '{imóvel}', '{pix}', '{mês}', '{link}'])
  })
  it('dados de exemplo cobrem todas', () => {
    for (const v of REMINDER_VARIABLES) expect(SAMPLE_VARIABLES[v.name], v.name).toBeTruthy()
  })
})
