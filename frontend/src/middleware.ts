import { type NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { authCookieOptions } from '@/lib/go/auth-cookies'

function parseJwt(token: string) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
  } catch {
    return null
  }
}

const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

/** Header `cookie` do request sem os tokens de sessão, mais `extra` ao final. */
function cookieHeader(request: NextRequest, extra: string[]) {
  return request.cookies
    .getAll()
    .filter(c => c.name !== 'access_token' && c.name !== 'refresh_token')
    .map(c => `${c.name}=${c.value}`)
    .concat(extra)
    .join('; ')
}

export async function middleware(request: NextRequest) {
  const cookieStore = await cookies()
  let accessToken = cookieStore.get('access_token')?.value
  let refreshToken = cookieStore.get('refresh_token')?.value

  const { pathname } = request.nextUrl

  const publicRoutes = ['/login', '/auth/callback', '/', '/p']
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))

  let response = NextResponse.next()

  if (!accessToken || !refreshToken) {
    if (!isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname + request.nextUrl.search)
      return NextResponse.redirect(url)
    }
    return response
  }

  // Token expiration check
  const payload = parseJwt(accessToken)
  // Refresh if unparseable, less than 1 minute remaining or already expired
  const needsRefresh = !payload || typeof payload.exp !== 'number' || payload.exp * 1000 - Date.now() < 60000
  // Só é "sessão confirmada" com token ainda válido ou refresh bem-sucedido. Falha transitória
  // (5xx, rede) não confirma: em /login isso mostra o formulário em vez de redirecionar para /
  // (que sem backend voltaria para /login em loop).
  let sessionConfirmed = !needsRefresh
  if (needsRefresh) {
    try {
      const apiUrl = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:8080'
      const refreshRes = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      })

      if (refreshRes.ok) {
        const data = await refreshRes.json()
        accessToken = data.data.access_token
        refreshToken = data.data.refresh_token

        // Pass to Next.js downstream so Server Components see the new token
        const requestHeaders = new Headers(request.headers)
        requestHeaders.set('cookie', cookieHeader(request, [`access_token=${accessToken}`, `refresh_token=${refreshToken}`]))

        response = NextResponse.next({ request: { headers: requestHeaders } })
        // Next.js requires setting cookies on the response AFTER recreating it
        response.cookies.set('access_token', accessToken!, authCookieOptions())
        response.cookies.set('refresh_token', refreshToken!, authCookieOptions())
        sessionConfirmed = true
      } else if (refreshRes.status === 400 || refreshRes.status === 401) {
        // Sessão morta (refresh recusado).
        if (!isPublicRoute) {
          const url = request.nextUrl.clone()
          url.pathname = '/login'
          url.searchParams.set('next', pathname)
          // Sem deletes: o refresh token é revogado no uso, então em requests concorrentes o
          // perdedor receberia 401 e apagaria os tokens novos do vencedor. /login funciona com
          // cookies mortos (cai na rota pública abaixo) e o login os sobrescreve.
          return NextResponse.redirect(url)
        }
        // Rota pública: renderiza deslogado só para este request (tira os tokens do request
        // repassado). NÃO emite deletes: o refresh token é revogado no uso, então em requests
        // concorrentes o perdedor receberia 401 e apagaria os tokens novos gravados pelo vencedor.
        const requestHeaders = new Headers(request.headers)
        const remaining = cookieHeader(request, [])
        if (remaining) requestHeaders.set('cookie', remaining)
        else requestHeaders.delete('cookie')
        accessToken = undefined
        refreshToken = undefined
        response = NextResponse.next({ request: { headers: requestHeaders } })
      } else {
        // Outro status (5xx, 429...): falha transitória, não indica sessão morta.
        console.error(`Failed to refresh token in middleware: status ${refreshRes.status}`)
      }
    } catch (e) {
      console.error("Failed to refresh token in middleware:", e)
    }
  }

  // Só GET/HEAD: um POST em /login é a Server Action de login; redirecioná-lo (307) o reenviaria
  // como POST para / e quebraria a página. `session=expired` vem de páginas cujo backend rejeitou
  // um token que parecia válido: sem pular o redirect, / <-> /login entraria em loop.
  const isNavigation = request.method === 'GET' || request.method === 'HEAD'
  const sessionExpiredSignal = request.nextUrl.searchParams.get('session') === 'expired'
  if (sessionConfirmed && accessToken && refreshToken && pathname === '/login' && isNavigation && !sessionExpiredSignal) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = '' // não vazar ?next=... para /
    const redirectRes = NextResponse.redirect(url)
    // O redirect é uma resposta nova: sem isto, tokens recém-renovados (o refresh antigo já foi
    // revogado) seriam descartados e o usuário perderia a sessão.
    if (needsRefresh) {
      redirectRes.cookies.set('access_token', accessToken, authCookieOptions())
      redirectRes.cookies.set('refresh_token', refreshToken, authCookieOptions())
    }
    return redirectRes
  }

  // Sem organização: o owner precisa criar a empresa antes de usar o app. Usa a claim do access
  // token atual (já renovado acima quando foi preciso). Sem chamada de rede.
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''
    const res = NextResponse.redirect(url)
    if (needsRefresh && accessToken && refreshToken) {
      res.cookies.set('access_token', accessToken, authCookieOptions())
      res.cookies.set('refresh_token', refreshToken, authCookieOptions())
    }
    return res
  }
  if (sessionConfirmed && accessToken && isNavigation) {
    const claims = parseJwt(accessToken)
    const hasOrg = typeof claims?.organization_id === 'string' && claims.organization_id !== ZERO_UUID
    const exempt = pathname === '/onboarding' || pathname === '/login' || pathname.startsWith('/auth/callback') || pathname === '/p' || pathname.startsWith('/p/') || pathname === '/invite/accept'
    if (!hasOrg && !exempt) return redirectTo('/onboarding')
    if (hasOrg && pathname === '/onboarding') return redirectTo('/')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}