import { redirect } from 'next/navigation'
import { Suspense } from "react"
import { Receipt, Download, BarChart3 } from "lucide-react"
import { goFetch } from "@/lib/go/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cookies } from 'next/headers'
import { getActivePropertiesWithUnits } from "@/app/leases/actions"
import { ExpenseDialog } from "@/components/expenses/ExpenseDialog"

type Property = { id: string; name: string; units: { id: string; label: string }[] }

interface Expense {
  id: string
  unit_id?: string
  due_date: string
  description: string
  amount: number
  category: string
  status: string
}

const CATEGORY_LABELS: Record<string, { label: string; class: string }> = {
  MAINTENANCE: { label: "Manutenção", class: "bg-blue-100 text-blue-700" },
  ELECTRICITY: { label: "Energia", class: "bg-yellow-100 text-yellow-700" },
  WATER: { label: "Água", class: "bg-cyan-100 text-cyan-700" },
  CONDO: { label: "Condomínio", class: "bg-purple-100 text-purple-700" },
  TAX: { label: "Impostos", class: "bg-orange-100 text-orange-700" },
  OTHER: { label: "Outros", class: "bg-zinc-100 text-zinc-600" },
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  PAID: { label: "Pago", class: "bg-green-100 text-green-700" },
  PENDING: { label: "Pendente", class: "bg-orange-100 text-orange-700" },
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

async function getExpensesData() {
  let expenses: Expense[] = []
  try {
    expenses = await goFetch<Expense[]>("/api/v1/expenses", {}) || []
  } catch (e) {
    console.error("Expenses error:", e)
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)
  const byCategory: Record<string, number> = {}
  expenses.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
  })
  const categories = Object.entries(byCategory)
    .map(([cat, amt]) => ({ category: cat, amount: amt }))
    .sort((a, b) => b.amount - a.amount)

  return { expenses, total, categories }
}

async function ExpensesList({ search, category, properties }: { search?: string; category?: string; properties: Property[] }) {
  const { expenses, total, categories } = await getExpensesData()

  let filtered = expenses
  if (search) {
    filtered = filtered.filter((e) => e.description.toLowerCase().includes(search.toLowerCase()))
  }
  if (category && category !== "ALL") {
    filtered = filtered.filter((e) => e.category === category)
  }

  if (!filtered.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-zinc-200 rounded-xl bg-white">
        <p className="text-zinc-500 mb-4">Nenhuma despesa encontrada.</p>
        <ExpenseDialog properties={properties} />
      </div>
    )
  }

  const maxAmt = Math.max(...categories.map((c) => c.amount), 1)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2"><Receipt className="w-4 h-4 text-primary"/><span className="text-sm text-zinc-600">Total</span></div>
          <div className="text-xl font-bold">{formatCurrency(total)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-zinc-500"/><span className="text-sm text-zinc-600">Por Categoria</span></div>
          <div className="flex gap-2 items-end h-12">
            {categories.slice(0, 4).map((c) => (
              <div key={c.category} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-primary rounded-t" style={{ height: `${(c.amount / maxAmt) * 100}%` }}/>
                <span className="text-[10px] text-zinc-500 mt-1">{CATEGORY_LABELS[c.category]?.label || c.category}</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <form action="/expenses" method="GET" className="flex gap-2">
            <select name="category" defaultValue={category || "ALL"} className="h-9 px-3 rounded-lg border border-zinc-200 text-sm">
              <option value="ALL">Todas</option>
              <option value="MAINTENANCE">Manutenção</option>
              <option value="ELECTRICITY">Energia</option>
              <option value="WATER">Água</option>
              <option value="CONDO">Condomínio</option>
              <option value="TAX">Impostos</option>
            </select>
            <input name="q" placeholder="Buscar" defaultValue={search} className="h-9 px-3 rounded-lg border border-zinc-200 text-sm w-32"/>
          </form>
          <Button variant="ghost" size="sm"><Download className="w-4 h-4"/>Exportar</Button>
        </div>
        <table className="w-full">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase">Data</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase">Descrição</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase">Categoria</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 text-right">Valor</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((e) => (
              <tr key={e.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-mono text-sm">{formatDate(e.due_date)}</td>
                <td className="px-4 py-3 text-sm">{e.description}</td>
                <td className="px-4 py-3"><Badge className={CATEGORY_LABELS[e.category]?.class || "bg-zinc-100"}>{CATEGORY_LABELS[e.category]?.label || e.category}</Badge></td>
                <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(e.amount)}</td>
                <td className="px-4 py-3 text-center"><Badge className={STATUS_LABELS[e.status]?.class || "bg-zinc-100"}>{STATUS_LABELS[e.status]?.label || e.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')?.value

  if (!accessToken) {
    redirect('/login')
  }

  const { q, category } = await searchParams
  const properties = await getActivePropertiesWithUnits()

  return (
    <div className="container py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Despesas</h1>
          <p className="text-zinc-500">Fluxos de saída</p>
        </div>
        <ExpenseDialog properties={properties} />
      </div>

      <Suspense fallback={<div className="text-center py-10">Carregando...</div>}>
        <ExpensesList search={q} category={category} properties={properties} />
      </Suspense>
    </div>
  )
}