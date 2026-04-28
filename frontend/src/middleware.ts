import { type NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

function parseJwt(token: string) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
  } catch (e) {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const cookieStore = await cookies()
  let accessToken = cookieStore.get('access_token')?.value
  let refreshToken = cookieStore.get('refresh_token')?.value

  const { pathname } = request.nextUrl

  const publicRoutes = ['/login', '/auth/callback', '/']
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))

  let response = NextResponse.next()

  if (!accessToken || !refreshToken) {
    if (!isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
    return response
  }

  // Token expiration check
  const payload = parseJwt(accessToken)
  // Refresh if less than 1 minute remaining or already expired
  if (payload && (payload.exp * 1000 - Date.now() < 60000)) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8080'
      const refreshRes = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      })

      if (refreshRes.ok) {
        const data = await refreshRes.json()
        accessToken = data.data.access_token
        refreshToken = data.data.refresh_token

        // Set on response so browser saves them
        response.cookies.set('access_token', accessToken!, { httpOnly: true, path: '/' })
        response.cookies.set('refresh_token', refreshToken!, { httpOnly: true, path: '/' })
        
        // Pass to Next.js downstream so Server Components see the new token
        const requestHeaders = new Headers(request.headers)
        // Need to preserve other cookies if they exist, but for simplicity we append or replace
        // A better approach is to reconstruct the cookie header:
        const allCookies = request.cookies.getAll()
        const cookieString = allCookies
          .filter(c => c.name !== 'access_token' && c.name !== 'refresh_token')
          .map(c => `${c.name}=${c.value}`)
          .concat(`access_token=${accessToken}`, `refresh_token=${refreshToken}`)
          .join('; ')
        
        requestHeaders.set('cookie', cookieString)
        
        response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        })
        // Next.js requires setting cookies on the response AFTER recreating it
        response.cookies.set('access_token', accessToken!, { httpOnly: true, path: '/' })
        response.cookies.set('refresh_token', refreshToken!, { httpOnly: true, path: '/' })
      } else {
        // Refresh failed, redirect to login
        if (!isPublicRoute) {
          const url = request.nextUrl.clone()
          url.pathname = '/login'
          const redirectRes = NextResponse.redirect(url)
          redirectRes.cookies.delete('access_token')
          redirectRes.cookies.delete('refresh_token')
          return redirectRes
        }
      }
    } catch (e) {
      console.error("Failed to refresh token in middleware:", e)
    }
  }

  if (accessToken && refreshToken && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}