import { redirect } from 'next/navigation'
import { Suspense } from "react"
import { Plus, Search, TrendingUp, AlertCircle, MoreVertical, Receipt, Calendar } from "lucide-react"
import { goFetch } from "@/lib/go/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cookies } from 'next/headers'
import { getActiveLeases } from "./actions"
import { PaymentDialog } from "@/components/payments/PaymentDialog"

interface Payment {
  id: string
  lease_id: string
  due_date: string
  paid_date?: string
  gross_amount: number
  status: string
  description?: string
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  PAID: { label: "Pago", class: "bg-green-100 text-green-700" },
  PENDING: { label: "Pendente", class: "bg-orange-100 text-orange-700" },
  OVERDUE: { label: "Atrasado", class: "bg-red-100 text-red-700" },
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

async function getPaymentsData() {
  let payments: Payment[] = []
  try {
    payments = await goFetch<Payment[]>("/api/v1/payments", {}) || []
  } catch (e) {
    console.error("Payments error:", e)
  }

  const today = new Date().toISOString().split("T")[0]
  let received = 0, pending = 0, overdue = 0
  payments.forEach((p) => {
    if (p.status === "PAID") received += p.gross_amount
    else if (p.status === "OVERDUE" || p.due_date < today) overdue += p.gross_amount
    else pending += p.gross_amount
  })

  return { payments, received, pending, overdue }
}

interface Lease {
  id: string
  tenant_id: string
}

async function PaymentsList({ leases }: { leases: Lease[] }) {
  const { payments, received, pending, overdue } = await getPaymentsData()

  if (!payments.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-zinc-200 rounded-xl bg-white">
        <p className="text-zinc-500 mb-4">Nenhum pagamento encontrado.</p>
        <PaymentDialog leases={leases} />
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-green-600"/><span className="text-sm text-zinc-600">Recebido</span></div>
          <div className="text-xl font-bold text-green-600">{formatCurrency(received)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2"><Receipt className="w-4 h-4 text-orange-600"/><span className="text-sm text-zinc-600">Pendente</span></div>
          <div className="text-xl font-bold text-orange-600">{formatCurrency(pending)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4 text-red-600"/><span className="text-sm text-zinc-600">Atrasado</span></div>
          <div className="text-xl font-bold text-red-600">{formatCurrency(overdue)}</div>
        </CardContent></Card>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase">Vencimento</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase">Descrição</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 text-right">Valor</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 text-center">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400"> pago</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payments.map((p) => {
              const isOverdue = p.status !== "PAID" && p.due_date < new Date().toISOString().split("T")[0]
              const displayStatus = isOverdue ? "OVERDUE" : p.status
              return (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className={`px-4 py-3 font-mono text-sm ${isOverdue ? "text-red-600 font-semibold" : ""}`}>{formatDate(p.due_date)}</td>
                  <td className="px-4 py-3 text-sm">{p.description || "Aluguel"}</td>
                  <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(p.gross_amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={STATUS_LABELS[displayStatus]?.class || "bg-zinc-100"}>{STATUS_LABELS[displayStatus]?.label || p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{formatDate(p.paid_date || "")}</td>
                  <td className="px-4 py-3 text-center">
                    <Button variant="ghost" size="icon" className="w-8 h-8"><MoreVertical className="w-4 h-4"/></Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </>
  )
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')?.value

  if (!accessToken) {
    redirect('/login')
  }

  const { q } = await searchParams
  const leases = await getActiveLeases()

  return (
    <div className="container py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Pagamentos</h1>
          <p className="text-zinc-500">Receitas do portfólio</p>
        </div>
        <PaymentDialog leases={leases} />
      </div>

      <Card className="p-4">
        <form action="/payments" method="GET" className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4"/>
            <input name="q" placeholder="Buscar..." defaultValue={q} className="w-full h-10 pl-10 pr-4 rounded-xl border border-zinc-200"/>
          </div>
          <Button type="submit" variant="outline"><Calendar className="w-4 h-4"/></Button>
        </form>
      </Card>

      <Suspense fallback={<div className="text-center py-10">Carregando...</div>}>
        <PaymentsList leases={leases} />
      </Suspense>
    </div>
  )
}