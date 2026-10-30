import { describe, it, expect } from 'vitest'
import {
  inspectionSchema,
  inspectionUpdateSchema,
  itemSchema,
  toInspectionPayload,
  toItemPayload,
  validatePhotoFile,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_ITEM,
  CONDITION_LABELS,
  ROOM_SUGGESTIONS,
} from '@/lib/inspection-schemas'

const LEASE = '5f0b6c1e-4f4a-4b5c-8e0a-1f2d3c4b5a69'
const base = { lease_id: LEASE, type: 'ENTRY' as const, inspected_at: '2026-03-01' }

describe('inspectionSchema', () => {
  it('aceita o mínimo obrigatório', () => {
    expect(inspectionSchema.safeParse(base).success).toBe(true)
  })
  it('exige contrato, tipo e data', () => {
    expect(inspectionSchema.safeParse({ ...base, lease_id: '' }).success).toBe(false)
    expect(inspectionSchema.safeParse({ ...base, type: 'OUTRO' }).success).toBe(false)
    expect(inspectionSchema.safeParse({ ...base, inspected_at: '01/03/2026' }).success).toBe(false)
    expect(inspectionSchema.safeParse({ ...base, inspected_at: '' }).success).toBe(false)
  })
  it('observações até 4000 caracteres', () => {
    expect(inspectionSchema.safeParse({ ...base, general_notes: 'a'.repeat(4000) }).success).toBe(true)
    expect(inspectionSchema.safeParse({ ...base, general_notes: 'a'.repeat(4001) }).success).toBe(false)
  })
  it('payload usa RFC3339 e só envia copy_from_entry na saída', () => {
    const entry = toInspectionPayload({ ...base, general_notes: '', copy_from_entry: true })
    expect(entry.inspected_at).toBe('2026-03-01T00:00:00Z')
    expect(entry.general_notes).toBeUndefined()
    expect(entry.copy_from_entry).toBeUndefined()

    const exit = toInspectionPayload({ ...base, type: 'EXIT', copy_from_entry: true })
    expect(exit.copy_from_entry).toBe(true)
  })
})

describe('inspectionUpdateSchema', () => {
  it('exige a data', () => {
    expect(inspectionUpdateSchema.safeParse({ inspected_at: '' }).success).toBe(false)
    expect(inspectionUpdateSchema.safeParse({ inspected_at: '2026-04-01', general_notes: 'x' }).success).toBe(true)
  })
})

describe('itemSchema', () => {
  const item = { room: 'Sala', item: 'Piso', condition: 'GOOD' as const }
  it('aceita item válido', () => {
    expect(itemSchema.safeParse(item).success).toBe(true)
  })
  it('exige ambiente, item e condição conhecida', () => {
    expect(itemSchema.safeParse({ ...item, room: '' }).success).toBe(false)
    expect(itemSchema.safeParse({ ...item, item: '  ' }).success).toBe(false)
    expect(itemSchema.safeParse({ ...item, condition: 'BROKEN' }).success).toBe(false)
  })
  it('limites de tamanho', () => {
    expect(itemSchema.safeParse({ ...item, room: 'a'.repeat(101) }).success).toBe(false)
    expect(itemSchema.safeParse({ ...item, item: 'a'.repeat(151) }).success).toBe(false)
    expect(itemSchema.safeParse({ ...item, notes: 'a'.repeat(2001) }).success).toBe(false)
  })
  it('payload apara espaços e omite observação vazia', () => {
    expect(toItemPayload({ room: ' Sala ', item: ' Piso ', condition: 'FAIR', notes: '' })).toEqual({
      room: 'Sala',
      item: 'Piso',
      condition: 'FAIR',
    })
  })
})

describe('validatePhotoFile', () => {
  const file = (type: string, size: number) => ({ type, size, name: 'f' }) as File
  it('aceita JPEG, PNG e WebP até 10 MB', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validatePhotoFile(file(t, 1024))).toBeNull()
    }
    expect(validatePhotoFile(file('image/jpeg', MAX_PHOTO_BYTES))).toBeNull()
  })
  it('rejeita tipo e tamanho inválidos com mensagem clara', () => {
    expect(validatePhotoFile(file('application/pdf', 100))).toMatch(/JPEG, PNG ou WebP/)
    expect(validatePhotoFile(file('image/gif', 100))).toMatch(/JPEG, PNG ou WebP/)
    expect(validatePhotoFile(file('image/jpeg', MAX_PHOTO_BYTES + 1))).toMatch(/10 MB/)
    expect(validatePhotoFile(file('image/jpeg', 0))).toMatch(/vazio/)
  })
})

describe('constantes', () => {
  it('espelham o backend', () => {
    expect(MAX_PHOTO_BYTES).toBe(10 * 1024 * 1024)
    expect(MAX_PHOTOS_PER_ITEM).toBe(10)
    expect(Object.keys(CONDITION_LABELS)).toEqual(['GOOD', 'FAIR', 'POOR', 'DAMAGED', 'NOT_APPLICABLE'])
    expect(ROOM_SUGGESTIONS).toContain('Cozinha')
  })
})
