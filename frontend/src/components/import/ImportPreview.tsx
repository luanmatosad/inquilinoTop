"use client"

import { useMemo, useState } from "react"
import { ParsedSpreadsheet } from "@/components/import/FileUpload"
import { ColumnMapping } from "@/components/import/ColumnMapper"
import { validateDataset, ValidationResult } from "@/data/import/validation"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Filter, FileText, ArrowLeft, ArrowRight, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ImportPreviewProps {
  spreadsheet: ParsedSpreadsheet
  entityType: "property" | "tenant" | "lease"
  mapping: ColumnMapping
  onMappingChange: (mapping: ColumnMapping) => void
  onImport: () => void
  onBack: () => void
  isImporting: boolean
  duplicateStrategy: "skip" | "update" | "create"
  onDuplicateStrategyChange: (strategy: "skip" | "update" | "create") => void
}

type FilterType = "all" | "valid" | "invalid"

export function ImportPreview({
  spreadsheet,
  entityType,
  mapping,
  onMappingChange,
  onImport,
  onBack,
  isImporting,
  duplicateStrategy,
  onDuplicateStrategyChange,
}: ImportPreviewProps) {
  const [filter, setFilter] = useState<FilterType>("all")

  const mappedRows = useMemo(() => {
    return spreadsheet.rows.map((row) => {
      const mappedRow: Record<string, string> = {}
      spreadsheet.headers.forEach((header, index) => {
        const fieldName = mapping[header]
        if (fieldName) mappedRow[fieldName] = row[index] ?? ""
      })
      return mappedRow
    })
  }, [spreadsheet, mapping])

  const validationResults: ValidationResult[] = useMemo(
    () => validateDataset(mappedRows, entityType),
    [mappedRows, entityType]
  )

  const stats = useMemo(() => {
    const valid = validationResults.filter((r) => r.isValid).length
    return {
      total: validationResults.length,
      valid,
      invalid: validationResults.length - valid,
    }
  }, [validationResults])

  const filteredData = useMemo(() => {
    return validationResults
      .map((r, i) => ({ result: r, row: mappedRows[i], index: i }))
      .filter((item) => filter === "all" || (filter === "valid") === item.result.isValid)
  }, [validationResults, mappedRows, filter])

  const displayedFields = useMemo(
    () => Object.values(mapping).filter((f) => f && f !== "_ignore_"),
    [mapping]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800">
            <FileText className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
              Preview: {spreadsheet.fileName}
            </h3>
            <p className="text-sm text-neutral-500">
              {stats.total} linhas • {displayedFields.length} campos
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border bg-white dark:bg-neutral-900">
          <p className="text-sm text-neutral-500">Total</p>
          <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{stats.total}</p>
        </div>
        <div className="p-4 rounded-xl border bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800">
          <p className="text-sm text-emerald-600 dark:text-emerald-400">Válidas</p>
          <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{stats.valid}</p>
        </div>
        <div className={cn(
          "p-4 rounded-xl border",
          stats.invalid > 0
            ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
            : "bg-white dark:bg-neutral-900"
        )}>
          <p className={cn(
            "text-sm",
            stats.invalid > 0 ? "text-red-600 dark:text-red-400" : "text-neutral-500"
          )}>Com Erros</p>
          <p className={cn(
            "text-2xl font-semibold",
            stats.invalid > 0 ? "text-red-700 dark:text-red-300" : "text-neutral-900 dark:text-neutral-100"
          )}>{stats.invalid}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="h-9 rounded-lg border bg-white dark:bg-neutral-900 px-3 text-sm"
          >
            <option value="all">Todas ({stats.total})</option>
            <option value="valid">Válidas ({stats.valid})</option>
            <option value="invalid">Com Erros ({stats.invalid})</option>
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-neutral-600 dark:text-neutral-400">Duplicados:</label>
          <select
            value={duplicateStrategy}
            onChange={(e) => onDuplicateStrategyChange(e.target.value as "skip" | "update" | "create")}
            className="h-9 rounded-lg border bg-white dark:bg-neutral-900 px-3 text-sm"
          >
            <option value="skip">Pular</option>
            <option value="update">Atualizar</option>
            <option value="create">Criar duplicado</option>
          </select>
        </div>
      </div>

      {stats.invalid > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-900 dark:text-red-100">
              {stats.invalid} linha(s) com erros de validação
            </p>
            <p className="text-sm text-red-700 dark:text-red-300">
              Corrija os dados na planilha ou altere o mapeamento antes de importar.
            </p>
          </div>
        </div>
      )}

      {stats.invalid === 0 && stats.total > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div>
            <p className="font-medium text-emerald-900 dark:text-emerald-100">
              Todos os dados são válidos
            </p>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Pronto para importar {stats.total} registro(s).
            </p>
          </div>
        </div>
      )}

      <div className="border rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50 sticky top-0">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-neutral-600 dark:text-neutral-400 w-16">
                  #
                </th>
                {displayedFields.slice(0, 5).map((field) => (
                  <th key={field} className="text-left py-3 px-4 font-medium text-neutral-600 dark:text-neutral-400">
                    {field}
                  </th>
                ))}
                <th className="text-left py-3 px-4 font-medium text-neutral-600 dark:text-neutral-400 w-24">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredData.slice(0, 50).map(({ result, row, index }) => (
                <tr
                  key={index}
                  className={cn(
                    "transition-colors",
                    !result.isValid && "bg-red-50/50 dark:bg-red-900/10"
                  )}
                >
                  <td className="py-3 px-4 font-mono text-xs text-neutral-500">{index + 1}</td>
                  {displayedFields.slice(0, 5).map((field) => (
                    <td key={field} className="py-3 px-4 text-neutral-700 dark:text-neutral-300 max-w-40 truncate">
                      {row[field] || "-"}
                    </td>
                  ))}
                  <td className="py-3 px-4">
                    {result.isValid ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                        Válido
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                        {result.errors.length} erro(s)
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredData.length > 50 && (
        <p className="text-center text-sm text-neutral-500">
          Mostrando 50 de {filteredData.length} linhas
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <Button onClick={onImport} disabled={isImporting || stats.valid === 0} className="gap-2">
          {isImporting ? (
            <>
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Importar {stats.valid} registro(s)
            </>
          )}
        </Button>
      </div>
    </div>
  )
}