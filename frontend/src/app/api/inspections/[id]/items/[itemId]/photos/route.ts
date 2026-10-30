import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { goFetch } from "@/lib/go/client"
import { goErrorInfo } from "@/lib/go/errors"

// Upload multipart: server actions têm teto de 1 MB por padrão, e uma foto pode ter até 10 MB.
// O navegador envia para esta rota, que repassa o arquivo à Go API com o token httpOnly.
const MESSAGES: Record<string, { status: number; message: string }> = {
  INVALID_PHOTO: { status: 400, message: "A foto deve ser JPEG, PNG ou WebP." },
  PHOTO_TOO_LARGE: { status: 413, message: "A foto excede 10 MB." },
  PHOTO_LIMIT: { status: 422, message: "Este item já tem o máximo de 10 fotos." },
  INSPECTION_NOT_EDITABLE: { status: 409, message: "O laudo já foi concluído e não pode mais ser alterado." },
  NOT_FOUND: { status: 404, message: "Laudo ou item não encontrado." },
  NO_FILE: { status: 400, message: "Selecione uma foto." },
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await ctx.params

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Não foi possível ler o arquivo enviado." }, { status: 400 })
  }
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: MESSAGES.NO_FILE.message }, { status: 400 })
  }

  const body = new FormData()
  body.append("file", file, file.name)
  try {
    const photo = await goFetch(`/api/v1/inspections/${id}/items/${itemId}/photos`, { method: "POST", body })
    revalidatePath("/inspections/" + id)
    return NextResponse.json({ data: photo }, { status: 201 })
  } catch (error) {
    const { code, status } = goErrorInfo(error)
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 })
    }
    const known = code ? MESSAGES[code] : undefined
    if (known) return NextResponse.json({ error: known.message }, { status: known.status })
    console.error("Erro ao enviar foto do laudo:", error)
    return NextResponse.json({ error: "Erro ao enviar a foto." }, { status: status && status >= 400 ? status : 500 })
  }
}
