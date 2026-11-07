import { redirect } from "next/navigation"

// O cadastro agora é um painel lateral da lista (canvas: Imoveis-cadastrar).
export default function NewPropertyPage() {
  redirect("/properties?novo=1")
}
