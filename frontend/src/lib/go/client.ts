import { cookies } from 'next/headers'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export interface AuthUser {
  id: string
  email: string
  plan: string
  created_at: string
}

export interface AuthResponse {
  user?: AuthUser
  access_token: string
  refresh_token: string
}

export interface GoError {
  error: {
    code: string
    message: string
  }
}

async function getToken() {
  const cookieStore = await cookies()
  return cookieStore.get('access_token')?.value
}

async function getRefreshToken() {
  const cookieStore = await cookies()
  return cookieStore.get('refresh_token')?.value
}

async function setTokens(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies()
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  }
  cookieStore.set('access_token', accessToken, options)
  cookieStore.set('refresh_token', refreshToken, options)
}

async function clearTokens() {
  const cookieStore = await cookies()
  cookieStore.delete('access_token')
  cookieStore.delete('refresh_token')
}

export async function goFetch<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  }

  if (!skipAuth) {
    const token = await getToken()
    if (token) {
      ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
  })

  if (res.status === 401 && !skipAuth) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return goFetch<T>(path, options)
    }
    clearTokens()
    throw new Error('UNAUTHORIZED')
  }

  const data = await res.json()

  if (!res.ok) {
    const err = data as GoError
    throw new Error(err.error?.message || 'REQUEST_FAILED')
  }

  return data.data as T
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await goFetch<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  })

  setTokens(res.access_token, res.refresh_token)
  return res
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const res = await goFetch<AuthResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  })

  setTokens(res.access_token, res.refresh_token)
  return res
}

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken()
  if (refreshToken) {
    try {
      await goFetch('/api/v1/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
    } catch {
      // ignore
    }
  }
  clearTokens()
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return false

  try {
    const res = await goFetch<{ access_token: string; refresh_token: string }>(
      '/api/v1/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
        skipAuth: true,
      }
    )

    setTokens(res.access_token, res.refresh_token)
    return true
  } catch {
    return false
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getToken()
  if (!token) return null

  try {
    const res = await goFetch<AuthUser>('/api/v1/auth/me', { skipAuth: true })
    return res
  } catch {
    return null
  }
}