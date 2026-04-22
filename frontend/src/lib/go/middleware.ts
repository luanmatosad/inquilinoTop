import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function validateSession(request: NextRequest) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')?.value
  const refreshToken = cookieStore.get('refresh_token')?.value

  if (!accessToken || !refreshToken) {
    return { user: null, response: NextResponse.redirect(new URL('/login', request.url)) }
  }

  try {
    const response = NextResponse.next()
    return { user: { id: 'authenticated' }, response }
  } catch {
    return { user: null, response: NextResponse.redirect(new URL('/login', request.url)) }
  }
}

export async function getUserFromRequest(request: NextRequest) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')?.value

  if (!accessToken) {
    return null
  }

  // Decode JWT to extract user info (without verification for now)
  // The Go API validates on each request anyway
  try {
    const parts = accessToken.split('.')
    if (parts.length !== 3) return null

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
    return { id: payload.sub, email: payload.email }
  } catch {
    return null
  }
}

export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const cookieStore = await cookies()
  return !!cookieStore.get('access_token')?.value
}