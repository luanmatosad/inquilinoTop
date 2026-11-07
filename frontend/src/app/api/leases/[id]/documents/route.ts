import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { goFetch } from "@/lib/go/client"
import { validateContractFile } from "@/lib/lease-document"

// Upload multipart via rota (server actions têm teto de 1 MB). O arquivo é validado aqui antes de ir à Go API.
const UUID = /^[0-9a-fA-F-]{36}$/

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID.test(id)) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Não foi possível ler o arquivo enviado." }, { status: 400 })
  }
  const file = form.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecione um arquivo." }, { status: 400 })
  const invalid = validateContractFile(file)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const body = new FormData()
  body.append("file", file, file.name)
  body.append("entity_type", "lease")
  body.append("entity_id", id)
  try {
    const doc = await goFetch("/api/v1/documents", { method: "POST", body })
    revalidatePath("/leases/" + id)
    return NextResponse.json({ data: doc }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 })
    }
    console.error("Erro ao enviar contrato assinado:", error)
    return NextResponse.json({ error: "Erro ao enviar o arquivo." }, { status: 500 })
  }
}
