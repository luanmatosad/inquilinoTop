import { describe, it, expect } from 'vitest'
import { userIdFromToken } from '@/lib/go/session-user'

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')

describe('userIdFromToken', () => {
  it('lê o owner_id do payload do JWT', () => {
    expect(userIdFromToken(`h.${b64({ owner_id: 'u-1', organization_id: 'o-1' })}.s`)).toBe('u-1')
  })
  it.each([undefined, null, '', 'abc', 'a.b', 'a.!!!.c', `h.${b64({})}.s`])('inválido (%s): null', (v) => {
    expect(userIdFromToken(v as string)).toBeNull()
  })
})
