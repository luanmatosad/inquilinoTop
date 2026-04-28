"use client"

import { useState, useEffect } from "react"
import { goFetch } from "@/lib/go/client"
import { Upload, FileText, CheckCircle2, AlertCircle, Clock, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface ImportHistoryItem {
  id: string
  file_name: string
  entity_type: string
  total_rows: number
  successful_rows: number
  failed_rows: number
  status: string
  created_at: string
}

function getStatusIcon(status: string) {
  switch (status) {
    case "COMPLETED":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    case "FAILED":
      return <AlertCircle className="w-4 h-4 text-red-500" />
    default:
      return <Clock className="w-4 h-4 text-amber-500" />
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ImportHistoryPage() {
  const [imports, setImports] = useState<ImportHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await goFetch<{ data: ImportHistoryItem[] }>("/api/v1/import/history")
        setImports(response.data)
      } catch (error) {
        console.error("Failed to load history:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadHistory()
  }, [])

  const entityLabels: Record<string, string> = {
    property: "Imóvel",
    tenant: "Inquilino",
    lease: "Contrato",
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Histórico de Importações
          </h1>
          <p className="text-neutral-500 mt-1">
            Veja todas as importações anteriores
          </p>
        </div>
        <Link
          href="/import"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Nova Importação
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-neutral-500 mt-4">Carregando...</p>
        </div>
      ) : imports.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-full inline-flex mb-4">
            <FileText className="w-8 h-8 text-neutral-400" />
          </div>
          <p className="text-neutral-900 dark:text-neutral-100 font-medium">
            Nenhuma importação ainda
          </p>
          <p className="text-neutral-500 text-sm mt-1">
            Faça sua primeira importação de planilha
          </p>
          <Link
            href="/import"
            className="inline-flex items-center gap-2 mt-4 text-sm text-blue-600 hover:text-blue-700"
          >
            Importar dados
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">Data</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">Arquivo</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">Tipo</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">Registros</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {imports.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                  <td className="py-3 px-4 text-sm text-neutral-600 dark:text-neutral-400">
                    {formatDate(item.created_at)}
                  </td>
                  <td className="py-3 px-4 text-sm text-neutral-900 dark:text-neutral-100">
                    {item.file_name}
                  </td>
                  <td className="py-3 px-4 text-sm text-neutral-600 dark:text-neutral-400">
                    {entityLabels[item.entity_type] || item.entity_type}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {item.successful_rows}
                    </span>
                    {item.failed_rows > 0 && (
                      <span className="text-red-500"> / {item.failed_rows}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="inline-flex items-center gap-2">
                      {getStatusIcon(item.status)}
                      <span className={cn(
                        "text-sm",
                        item.status === "COMPLETED" && "text-emerald-600 dark:text-emerald-400",
                        item.status === "FAILED" && "text-red-600 dark:text-red-400",
                        item.status === "PROCESSING" && "text-amber-600 dark:text-amber-400"
                      )}>
                        {item.status === "COMPLETED" && "Concluído"}
                        {item.status === "FAILED" && "Falhou"}
                        {item.status === "PROCESSING" && "Processando"}
                        {item.status === "PENDING" && "Pendente"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}