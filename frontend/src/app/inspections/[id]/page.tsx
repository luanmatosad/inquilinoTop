import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { cookies } from "next/headers"
import { ArrowLeft, GitCompare } from "lucide-react"
import { goFetch } from "@/lib/go/client"
import { goErrorInfo } from "@/lib/go/errors"
import { Button } from "@/components/ui/button"
import { InspectionEditor } from "@/components/inspections/InspectionEditor"
import { getLeaseOptions, type InspectionDetail } from "@/lib/inspection-data"

export default async function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!cookieStore.get("access_token")?.value) redirect("/login")

  const { id } = await params
  let inspection: InspectionDetail
  try {
    inspection = await goFetch<InspectionDetail>(`/api/v1/inspections/${id}`, {})
  } catch (error) {
    if (goErrorInfo(error).status === 404) notFound()
    throw error
  }

  const leases = await getLeaseOptions()
  const leaseLabel = leases.find((l) => l.id === inspection.lease_id)?.label ?? "Contrato"
  // O backend não guarda a origem dos itens; em saída em rascunho, avisar que podem ter sido copiados.
  const copiedFromEntry = inspection.type === "EXIT" && inspection.status === "DRAFT" && inspection.items.length > 0

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/inspections"><ArrowLeft className="mr-2 h-4 w-4" />Laudos</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/inspections/compare/${inspection.lease_id}`}><GitCompare className="mr-2 h-4 w-4" />Comparar entrada × saída</Link>
        </Button>
      </div>
      <InspectionEditor inspection={inspection} leaseLabel={leaseLabel} copiedFromEntry={copiedFromEntry} />
    </div>
  )
}
