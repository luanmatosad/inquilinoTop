import { redirect } from "next/navigation"
import Link from "next/link"
import { cookies } from "next/headers"
import { ArrowLeft, TrendingDown } from "lucide-react"
import { goFetch } from "@/lib/go/client"
import { goErrorInfo } from "@/lib/go/errors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CONDITION_LABELS } from "@/lib/inspection-schemas"
import { formatDate, getLeaseOptions, type Comparison } from "@/lib/inspection-data"
import { cn } from "@/lib/utils"

export default async function ComparePage({ params }: { params: Promise<{ leaseId: string }> }) {
  const cookieStore = await cookies()
  if (!cookieStore.get("access_token")?.value) redirect("/login")

  const { leaseId } = await params
  const leases = await getLeaseOptions()
  const leaseLabel = leases.find((l) => l.id === leaseId)?.label ?? "Contrato"

  let comparison: Comparison | null = null
  let unavailable = false
  try {
    comparison = await goFetch<Comparison>(`/api/v1/leases/${leaseId}/inspections/compare`, {})
  } catch (error) {
    if (goErrorInfo(error).code === "COMPARISON_UNAVAILABLE") unavailable = true
    else throw error
  }

  const cond = (c: keyof typeof CONDITION_LABELS | null) => (c ? CONDITION_LABELS[c] : "—")
  const worsened = comparison?.rows.filter((r) => r.worsened).length ?? 0

  return (
    <div className="container py-8 space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/inspections"><ArrowLeft className="mr-2 h-4 w-4" />Laudos</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-bold">Entrada × saída</h1>
        <p className="text-muted-foreground">{leaseLabel}</p>
      </div>

      {unavailable || !comparison ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border bg-card text-center">
          <p className="text-muted-foreground">A comparação exige os laudos de entrada e de saída concluídos.</p>
          <Button variant="outline" asChild><Link href={`/inspections?lease_id=${leaseId}`}>Ver laudos do contrato</Link></Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span>Entrada: {formatDate(comparison.entry.inspected_at)}</span>
            <span>Saída: {formatDate(comparison.exit.inspected_at)}</span>
            <Badge variant={worsened ? "destructive" : "default"}>
              <TrendingDown /> {worsened} {worsened === 1 ? "item piorou" : "itens pioraram"}
            </Badge>
          </div>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.rows.map((r, i) => (
                  <TableRow key={i} className={cn(r.worsened && "bg-destructive/10")}>
                    <TableCell>{r.room}</TableCell>
                    <TableCell className="font-medium">{r.item}</TableCell>
                    <TableCell>{cond(r.entry_condition)}</TableCell>
                    <TableCell className={cn(r.worsened && "font-semibold text-destructive dark:text-red-400")}>
                      {cond(r.exit_condition)}{r.worsened && <span className="sr-only"> (piorou)</span>}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">
                      {[r.entry_notes && `Entrada: ${r.entry_notes}`, r.exit_notes && `Saída: ${r.exit_notes}`].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}
