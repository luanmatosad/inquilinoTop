import { redirect } from "next/navigation"

// A edição agora é a aba Informações do detalhe (canvas: Imoveis-detalhe).
export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/properties/${id}?aba=informacoes`)
}
