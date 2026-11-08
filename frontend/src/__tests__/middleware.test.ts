import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const jar = vi.hoisted(() => ({ cookies: {} as Record<string, string> }))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name in jar.cookies ? { value: jar.cookies[name] } : undefined),
  }),
}))

import { middleware } from '@/middleware'
import { SESSION_EXPIRED_LOGIN_URL } from '@/lib/session'

function jwt(expOffsetSec: number) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffsetSec })).toString('base64')
  return `h.${payload}.s`
}

function req(path: string, cookies: Record<string, string>, method = 'GET') {
  jar.cookies = cookies
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  return new NextRequest(`http://localhost:3000${path}`, { method, headers: cookie ? { cookie } : {} })
}

const setCookies = (res: Response) => res.headers.getSetCookie()
const hasDelete = (res: Response, name: string) =>
  setCookies(res).some((c) => c.startsWith(`${name}=;`) && /Max-Age=0|Expires=/i.test(c))
/** Nomes dos headers que o middleware repassa ao request downstream. */
const overridden = (res: Response) => (res.headers.get('x-middleware-override-headers') ?? '').split(',')
const forwardedCookie = (res: Response) => res.headers.get('x-middleware-request-cookie')

describe('middleware', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  describe('refresh recusado (400/401) em rota pública', () => {
    it.each([400, 401])('status %i: remove cookies do request repassado e NÃO emite deletes', async (status) => {
      fetchMock.mockResolvedValue({ ok: false, status })
      const res = await middleware(req('/', { access_token: 'garbage', refresh_token: 'garbage' }))
      expect(fetchMock).toHaveBeenCalledOnce()
      expect(res.status).toBe(200)
      expect(setCookies(res)).toHaveLength(0)
      // Sem nenhum outro cookie, o header cookie some do request repassado.
      expect(overridden(res)).not.toContain('cookie')
      expect(forwardedCookie(res)).toBeNull()
    })

    it('preserva cookies não relacionados no request repassado', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 401 })
      const res = await middleware(
        req('/', { theme: 'dark', access_token: jwt(-100), refresh_token: 'r', other: '1' }),
      )
      expect(overridden(res)).toContain('cookie')
      expect(forwardedCookie(res)).toBe('theme=dark; other=1')
      expect(setCookies(res)).toHaveLength(0)
    })

    it('/login não redireciona para / quando o refresh é recusado', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 401 })
      const res = await middleware(req('/login', { access_token: 'garbage', refresh_token: 'garbage' }))
      expect(res.status).toBe(200)
      expect(setCookies(res)).toHaveLength(0)
    })
  })

  describe('corrida de refresh (token de refresh é revogado no uso)', () => {
    it('perdedor em rota pública não apaga os tokens que o vencedor gravou', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { access_token: 'new-a', refresh_token: 'new-r' } }),
        })
        .mockResolvedValueOnce({ ok: false, status: 401 })
      const [winner, loser] = await Promise.all([
        middleware(req('/', { access_token: jwt(-100), refresh_token: 'r' })),
        middleware(req('/', { access_token: jwt(-100), refresh_token: 'r' })),
      ])
      expect(setCookies(winner).join('\n')).toContain('access_token=new-a')
      expect(setCookies(loser)).toHaveLength(0)
      expect(hasDelete(loser, 'access_token')).toBe(false)
      expect(hasDelete(loser, 'refresh_token')).toBe(false)
    })
  })

  describe('rota privada', () => {
    it('refresh recusado redireciona para /login, mantém next e NÃO emite deletes', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 401 })
      const res = await middleware(req('/properties', { access_token: jwt(-100), refresh_token: 'r' }))
      expect(res.status).toBe(307)
      const location = new URL(res.headers.get('location')!)
      expect(location.pathname).toBe('/login')
      expect(location.searchParams.get('next')).toBe('/properties')
      // Perdedor de uma corrida de refresh não pode apagar os tokens novos do vencedor.
      expect(setCookies(res)).toHaveLength(0)
      expect(hasDelete(res, 'access_token')).toBe(false)
      expect(hasDelete(res, 'refresh_token')).toBe(false)
    })

    it('perdedor da corrida em rota privada não apaga os tokens do vencedor', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { access_token: 'new-a', refresh_token: 'new-r' } }),
        })
        .mockResolvedValueOnce({ ok: false, status: 401 })
      const [winner, loser] = await Promise.all([
        middleware(req('/tenants', { access_token: jwt(-100), refresh_token: 'r' })),
        middleware(req('/tenants', { access_token: jwt(-100), refresh_token: 'r' })),
      ])
      expect(setCookies(winner).join('\n')).toContain('access_token=new-a')
      expect(loser.status).toBe(307)
      expect(setCookies(loser)).toHaveLength(0)
    })

    it('sem tokens redireciona para /login com next', async () => {
      const res = await middleware(req('/properties', {}))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).searchParams.get('next')).toBe('/properties')
    })

    it('página pública da cobrança (/p/<token>) abre sem sessão', async () => {
      for (const path of ['/p/abc123', '/p/abc123/recibo']) {
        const res = await middleware(req(path, {}))
        expect(res.status, path).toBe(200)
        expect(res.headers.get('location'), path).toBeNull()
      }
    })

    it('/payments continua exigindo sessão (não é /p)', async () => {
      const res = await middleware(req('/payments', {}))
      expect(res.status).toBe(307)
    })

    it.each(['/reports', '/integrations'])('%s (placeholder do menu) exige sessão', async (path) => {
      const res = await middleware(req(path, {}))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
      expect(new URL(res.headers.get('location')!).searchParams.get('next')).toBe(path)
    })
  })

  describe('falhas que não indicam sessão morta', () => {
    it.each([500, 502, 429])('status %i em rota pública: segue sem apagar nada', async (status) => {
      fetchMock.mockResolvedValue({ ok: false, status })
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await middleware(req('/', { access_token: jwt(-100), refresh_token: 'r' }))
      expect(res.status).toBe(200)
      expect(setCookies(res)).toHaveLength(0)
      expect(forwardedCookie(res)).toBeNull() // request intacto: sem override
      expect(overridden(res)).not.toContain('cookie')
      spy.mockRestore()
    })

    it('status 503 em rota privada não redireciona nem apaga cookies', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503 })
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await middleware(req('/properties', { access_token: jwt(-100), refresh_token: 'r' }))
      expect(res.status).toBe(200)
      expect(setCookies(res)).toHaveLength(0)
      spy.mockRestore()
    })

    it('erro de rede: segue sem apagar cookies e loga', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'))
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await middleware(req('/', { access_token: jwt(-100), refresh_token: 'r' }))
      expect(res.status).toBe(200)
      expect(setCookies(res)).toHaveLength(0)
      expect(spy).toHaveBeenCalledOnce()
      spy.mockRestore()
    })
  })

  describe('/login', () => {
    it('refresh bem-sucedido: redireciona para / levando os cookies novos', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { access_token: 'new-a', refresh_token: 'new-r' } }),
      })
      const res = await middleware(req('/login', { access_token: jwt(30), refresh_token: 'r' }))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/')
      const cookies = setCookies(res)
      for (const name of ['access_token=new-a', 'refresh_token=new-r']) {
        const c = cookies.find((x) => x.startsWith(name))!
        expect(c).toBeDefined()
        expect(c).toMatch(/HttpOnly/i)
        expect(c).toMatch(/SameSite=lax/i)
        expect(c).toMatch(/Max-Age=2592000/)
      }
    })

    it('em produção o redirect leva cookies Secure', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { access_token: 'new-a', refresh_token: 'new-r' } }),
      })
      const res = await middleware(req('/login', { access_token: jwt(30), refresh_token: 'r' }))
      expect(setCookies(res)).toHaveLength(2)
      for (const c of setCookies(res)) expect(c).toMatch(/Secure/i)
    })

    it('token ainda válido: redireciona para / sem refresh', async () => {
      const res = await middleware(req('/login', { access_token: jwt(3600), refresh_token: 'r' }))
      expect(fetchMock).not.toHaveBeenCalled()
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/')
      expect(setCookies(res)).toHaveLength(0) // sem refresh, sem Set-Cookie
    })

    it('redirect para / não vaza a query string (?next=...)', async () => {
      const res = await middleware(req('/login?next=%2Ftenants&mode=login', { access_token: jwt(3600), refresh_token: 'r' }))
      expect(res.status).toBe(307)
      const location = new URL(res.headers.get('location')!)
      expect(location.pathname).toBe('/')
      expect(location.search).toBe('')
    })

    it('regressão do loop: token com exp futuro rejeitado pelo backend não gera / <-> /login', async () => {
      const cookies = { access_token: jwt(3600), refresh_token: 'r' }
      // 1) GET / passa (token parece válido; quem rejeita é o backend, na página).
      const first = await middleware(req('/', cookies))
      expect(first.status).toBe(200)
      // 2) a página redireciona para SESSION_EXPIRED_LOGIN_URL; o middleware NÃO pode devolver para /.
      const second = await middleware(req(SESSION_EXPIRED_LOGIN_URL, cookies))
      expect(second.status).toBe(200)
      expect(second.headers.get('location')).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled() // refresh token não é queimado
      // 3) sem o sinal, /login com sessão válida continua indo para /.
      const plain = await middleware(req('/login', cookies))
      expect(plain.status).toBe(307)
    })

    it('SESSION_EXPIRED_LOGIN_URL aponta para /login com session=expired', () => {
      const url = new URL(SESSION_EXPIRED_LOGIN_URL, 'http://localhost')
      expect(url.pathname).toBe('/login')
      expect(url.searchParams.get('session')).toBe('expired')
    })

    it('Server Action (POST) em /login com sessão válida não é redirecionada', async () => {
      const res = await middleware(req('/login', { access_token: jwt(3600), refresh_token: 'r' }, 'POST'))
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
    })

    it('POST em /login com token recém-renovado ainda recebe Set-Cookie', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { access_token: 'new-a', refresh_token: 'new-r' } }),
      })
      const res = await middleware(req('/login', { access_token: jwt(30), refresh_token: 'r' }, 'POST'))
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
      const set = setCookies(res).join('\n')
      expect(set).toContain('access_token=new-a')
      expect(set).toContain('refresh_token=new-r')
    })

    it('HEAD em /login com sessão válida redireciona como GET', async () => {
      const res = await middleware(req('/login', { access_token: jwt(3600), refresh_token: 'r' }, 'HEAD'))
      expect(res.status).toBe(307)
    })

    it.each([429, 500, 503])('status %i no refresh: mostra o login (não redireciona, não apaga)', async (status) => {
      fetchMock.mockResolvedValue({ ok: false, status })
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await middleware(req('/login', { access_token: jwt(-100), refresh_token: 'r' }))
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
      expect(setCookies(res)).toHaveLength(0)
      spy.mockRestore()
    })

    it('erro de rede no refresh: mostra o login (não redireciona, não apaga)', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'))
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await middleware(req('/login', { access_token: jwt(-100), refresh_token: 'r' }))
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
      expect(setCookies(res)).toHaveLength(0)
      spy.mockRestore()
    })
  })

  describe('refresh bem-sucedido', () => {
    const ok = {
      ok: true,
      json: async () => ({ data: { access_token: 'new-a', refresh_token: 'new-r' } }),
    }

    it('grava tokens com os mesmos atributos de setTokens e repassa ao downstream', async () => {
      fetchMock.mockResolvedValue(ok)
      const res = await middleware(req('/', { theme: 'dark', access_token: jwt(-100), refresh_token: 'r' }))
      const cookies = setCookies(res)
      for (const name of ['access_token=new-a', 'refresh_token=new-r']) {
        const c = cookies.find((x) => x.startsWith(name))!
        expect(c).toBeDefined()
        expect(c).toMatch(/HttpOnly/i)
        expect(c).toMatch(/SameSite=lax/i)
        expect(c).toMatch(/Max-Age=2592000/)
        expect(c).toMatch(/Path=\//)
        expect(c).not.toMatch(/Secure/i)
      }
      expect(overridden(res)).toContain('cookie')
      expect(forwardedCookie(res)).toBe('theme=dark; access_token=new-a; refresh_token=new-r')
    })

    it('em produção os cookies saem Secure', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      fetchMock.mockResolvedValue(ok)
      const res = await middleware(req('/', { access_token: jwt(-100), refresh_token: 'r' }))
      for (const c of setCookies(res)) expect(c).toMatch(/Secure/i)
    })

    it('token válido não chama refresh nem seta cookies', async () => {
      const res = await middleware(req('/', { access_token: jwt(3600), refresh_token: 'r' }))
      expect(fetchMock).not.toHaveBeenCalled()
      expect(res.status).toBe(200)
      expect(setCookies(res)).toHaveLength(0)
    })
  })
})
