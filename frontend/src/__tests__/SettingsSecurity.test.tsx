import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { changePassword, startTwoFactor, confirmTwoFactor, disableTwoFactor } from '@/app/settings/security/actions'
import SecurityPage from '@/app/settings/security/page'

const goError = (code: string) => Object.assign(new Error(code), { code })

beforeEach(() => {
  goFetch.mockReset()
  refresh.mockReset()
  Object.values(toast).forEach((f) => f.mockReset())
})

describe('actions de segurança', () => {
  const ok = { current_password: 'senha123', new_password: 'novasenha1', confirm_password: 'novasenha1' }

  it('changePassword: valida antes de chamar a API', async () => {
    const res = await changePassword({ ...ok, confirm_password: 'diferente1' })
    expect(res).toEqual({ error: 'A confirmação não confere com a nova senha.' })
    expect(goFetch).not.toHaveBeenCalled()
  })

  it('changePassword: manda só a atual e a nova, e traduz os erros do backend', async () => {
    goFetch.mockResolvedValue({})
    expect(await changePassword(ok)).toEqual({ success: true })
    expect(goFetch).toHaveBeenCalledWith('/api/v1/auth/password', { method: 'POST', body: JSON.stringify({ current_password: 'senha123', new_password: 'novasenha1' }) })

    goFetch.mockRejectedValue(goError('INVALID_PASSWORD'))
    expect(await changePassword(ok)).toEqual({ error: 'A senha atual está incorreta.' })
    goFetch.mockRejectedValue(new Error('boom'))
    expect(await changePassword(ok)).toEqual({ error: 'Erro ao trocar a senha.' })
  })

  it('startTwoFactor: devolve o segredo e o QR em SVG', async () => {
    goFetch.mockResolvedValue({ secret: 'ABCDEF', qr_code_url: 'otpauth://totp/InquilinoTop:a@b.com?secret=ABCDEF' })
    const res = await startTwoFactor()
    expect(goFetch).toHaveBeenCalledWith('/api/v1/auth/2fa/setup', { method: 'POST' })
    expect(res).toMatchObject({ secret: 'ABCDEF' })
    expect('qrSvg' in res && res.qrSvg).toContain('<svg')
  })

  it('startTwoFactor: já ligado', async () => {
    goFetch.mockRejectedValue(goError('ALREADY_ENABLED'))
    expect(await startTwoFactor()).toEqual({ error: 'A verificação em duas etapas já está ligada.' })
  })

  it('confirmTwoFactor: código fora do formato nem chama a API; erros traduzidos; sucesso devolve os códigos', async () => {
    expect(await confirmTwoFactor('12345')).toEqual({ error: 'Informe os 6 dígitos do aplicativo.' })
    expect(goFetch).not.toHaveBeenCalled()

    goFetch.mockRejectedValue(goError('INVALID_CODE'))
    expect(await confirmTwoFactor('123456')).toEqual({ error: 'Código incorreto. Confira o aplicativo e tente de novo.' })
    goFetch.mockRejectedValue(goError('NOT_CONFIGURED'))
    expect((await confirmTwoFactor('123456')) as { error: string }).toMatchObject({ error: expect.stringMatching(/QR Code/) })

    goFetch.mockResolvedValue({ two_factor_enabled: true, backup_codes: ['1111111111', '2222222222'] })
    expect(await confirmTwoFactor('123456')).toEqual({ backupCodes: ['1111111111', '2222222222'] })
    expect(goFetch).toHaveBeenLastCalledWith('/api/v1/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ code: '123456' }) })
  })

  it('disableTwoFactor: exige senha e traduz "senha incorreta"', async () => {
    expect(await disableTwoFactor('')).toEqual({ error: 'Informe a sua senha.' })
    goFetch.mockRejectedValue(goError('DISABLE_2FA_FAILED'))
    expect(await disableTwoFactor('errada')).toEqual({ error: 'Senha incorreta.' })
    goFetch.mockResolvedValue({})
    expect(await disableTwoFactor('certa123')).toEqual({ success: true })
  })
})

describe('Página de Segurança', () => {
  const renderPage = async () => render(await SecurityPage())

  it('2FA desligado: mostra senha e o botão Ativar', async () => {
    goFetch.mockResolvedValue({ email: 'a@b.com', two_factor_enabled: false })
    await renderPage()
    expect(screen.getByRole('region', { name: 'Senha' })).toBeTruthy()
    expect(screen.getByText('Desligada')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ativar' })).toBeTruthy()
  })

  it('2FA ligado: mostra "Ligada" e Desligar', async () => {
    goFetch.mockResolvedValue({ two_factor_enabled: true })
    await renderPage()
    expect(screen.getByText('Ligada')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Desligar' })).toBeTruthy()
  })

  it('perfil indisponível: aviso e senha continua', async () => {
    goFetch.mockRejectedValue(new Error('boom'))
    await renderPage()
    expect(screen.getByText(/Não foi possível carregar a verificação em duas etapas/)).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Senha' })).toBeTruthy()
  })

  it('formulário de senha: valida e chama a action', async () => {
    goFetch.mockImplementation(async (path: string) => (path.endsWith('/profile') ? { two_factor_enabled: false } : {}))
    const user = userEvent.setup()
    await renderPage()
    await user.type(screen.getByLabelText('Senha atual'), 'senha123')
    await user.type(screen.getByLabelText('Nova senha'), 'novasenha1')
    await user.type(screen.getByLabelText('Confirmar a nova senha'), 'outra12345')
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/confirmação não confere/)
    expect(goFetch).not.toHaveBeenCalledWith('/api/v1/auth/password', expect.anything())

    await user.clear(screen.getByLabelText('Confirmar a nova senha'))
    await user.type(screen.getByLabelText('Confirmar a nova senha'), 'novasenha1')
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Senha alterada.'))
    expect((screen.getByLabelText('Senha atual') as HTMLInputElement).value).toBe('')
  })

  it('ativar o 2FA: QR, código, códigos de recuperação uma vez e concluir', async () => {
    goFetch.mockImplementation(async (path: string) => {
      if (path.endsWith('/profile')) return { two_factor_enabled: false }
      if (path.endsWith('/2fa/setup')) return { secret: 'SEGREDO123', qr_code_url: 'otpauth://totp/x?secret=SEGREDO123' }
      if (path.endsWith('/2fa/verify')) return { two_factor_enabled: true, backup_codes: ['1111111111', '2222222222'] }
      return {}
    })
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Ativar' }))
    expect(await screen.findByRole('img', { name: /QR Code/ })).toBeTruthy()
    expect(screen.getByText('SEGREDO123')).toBeTruthy()

    const confirm = screen.getByRole('button', { name: 'Confirmar' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    await user.type(screen.getByLabelText('Código de 6 dígitos'), '123456')
    await user.click(confirm)

    const codes = await screen.findByRole('list', { name: 'Códigos de recuperação' })
    expect(codes.textContent).toContain('1111111111')
    const done = screen.getByRole('button', { name: 'Concluir' }) as HTMLButtonElement
    expect(done.disabled).toBe(true)
    await user.click(screen.getByLabelText('Guardei os códigos'))
    expect(done.disabled).toBe(false)
    await user.click(done)
    expect(refresh).toHaveBeenCalled()
    expect(screen.queryByRole('list', { name: 'Códigos de recuperação' })).toBeNull()
  })

  it('código errado no 2FA mostra o erro e segue na confirmação', async () => {
    goFetch.mockImplementation(async (path: string) => {
      if (path.endsWith('/profile')) return { two_factor_enabled: false }
      if (path.endsWith('/2fa/setup')) return { secret: 'S', qr_code_url: 'otpauth://totp/x?secret=S' }
      throw goError('INVALID_CODE')
    })
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Ativar' }))
    await user.type(await screen.findByLabelText('Código de 6 dígitos'), '000000')
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Código incorreto/)
    expect(screen.queryByRole('list', { name: 'Códigos de recuperação' })).toBeNull()
  })

  it('desligar o 2FA pede a senha', async () => {
    goFetch.mockImplementation(async (path: string) => (path.endsWith('/profile') ? { two_factor_enabled: true } : {}))
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Desligar' }))
    const confirm = screen.getAllByRole('button', { name: 'Desligar' }).pop() as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    await user.type(screen.getByLabelText('Senha', { selector: 'input#disable-password' }), 'certa123')
    await user.click(confirm)
    await waitFor(() => expect(goFetch).toHaveBeenCalledWith('/api/v1/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password: 'certa123' }) }))
    expect(refresh).toHaveBeenCalled()
  })
})
