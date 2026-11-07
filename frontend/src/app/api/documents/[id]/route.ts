import { getToken } from "@/lib/go/client"

// O token fica em cookie httpOnly e um link <a> não envia Authorization: esta rota busca o arquivo na
// Go API com o token do usuário e o repassa. A Go API só entrega documentos do próprio dono.
const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
const UUID = /^[0-9a-fA-F-]{36}$/

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID.test(id)) return new Response("Not found", { status: 404 })
  const token = await getToken()
  if (!token) return new Response("Unauthorized", { status: 401 })

  const upstream = await fetch(`${API_URL}/api/v1/documents/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!upstream.ok || !upstream.body) return new Response("Not found", { status: upstream.status === 401 ? 401 : 404 })

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": upstream.headers.get("Content-Disposition") ?? "attachment",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  })
}
