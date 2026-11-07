import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { LeaseDocuments } from '@/components/leases/LeaseDocuments'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({}) })
  vi.stubGlobal('fetch', fetchMock)
  Object.values(toast).forEach((f) => f.mockReset())
  refresh.mockReset()
})

describe('LeaseDocuments', () => {
  it('lista com link de download', () => {
    render(<LeaseDocuments leaseId="l1" documents={[{ id: 'd1', filename: 'contrato.pdf', created: '06/11/2026' }]} />)
    expect(screen.getByRole('link', { name: 'contrato.pdf' })).toHaveAttribute('href', '/api/documents/d1')
  })

  it('recusa arquivo que não é PDF/DOC sem chamar o backend', async () => {
    render(<LeaseDocuments leaseId="l1" documents={[]} />)
    await userEvent.upload(screen.getByLabelText('Anexar contrato assinado'), new File(['x'], 'foto.png', { type: 'image/png' }), { applyAccept: false })
    expect(toast.error).toHaveBeenCalledWith('Envie um arquivo PDF, DOC ou DOCX.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('recusa arquivo acima de 10 MB', async () => {
    render(<LeaseDocuments leaseId="l1" documents={[]} />)
    const big = new File(['x'], 'grande.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })
    await userEvent.upload(screen.getByLabelText('Anexar contrato assinado'), big)
    expect(toast.error).toHaveBeenCalledWith('O arquivo excede 10 MB.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envia arquivo válido para a rota do contrato', async () => {
    render(<LeaseDocuments leaseId="l1" documents={[]} />)
    await userEvent.upload(screen.getByLabelText('Anexar contrato assinado'), new File(['x'], 'ok.pdf', { type: 'application/pdf' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/leases/l1/documents', expect.objectContaining({ method: 'POST' })))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
})
