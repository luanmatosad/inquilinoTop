/**
 * Atributos dos cookies de sessão. Compartilhado por `setTokens` (server-auth.ts, que é
 * "use server" e só pode exportar funções async) e pelo middleware, para que um refresh
 * no middleware grave os cookies exatamente como o login.
 */
export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  }
}
