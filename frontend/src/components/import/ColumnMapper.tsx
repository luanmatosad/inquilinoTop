"use client"

import { useMemo, useState } from "react"
import { FieldDefinition, ENTITY_FIELDS } from "@/data/import/validation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface ColumnMapping {
  [spreadsheetColumn: string]: string
}

interface ColumnMapperProps {
  headers: string[]
  entityType: "property" | "tenant" | "lease"
  mapping: ColumnMapping
  onMappingChange: (mapping: ColumnMapping) => void
  onContinue: () => void
  onBack: () => void
}

const AUTO_DETECTION_KEYWORDS: Record<string, string[]> = {
  name: ["nome", "name", "nome do imóvel", "nome do imóvel", "property name"],
  type: ["tipo", "type", "tipo do imóvel"],
  address_line: [
    "endereço",
    "address",
    "endereço do imóvel",
    "logradouro",
    "rua",
    "street",
  ],
  city: ["cidade", "city", "localidade"],
  state: ["estado", "uf", "state"],
  cpf: ["cpf", "documento", "cpf/cnpj", "cpf titular"],
  cnpj: ["cnpj", "documento", "cpf/cnpj", "cnpj proprietario"],
  email: ["email", "e-mail", "mail"],
  phone: ["telefone", "phone", "fone", "celular", "whatsapp"],
}

function detectField(header: string): string | null {
  const normalizedHeader = header.toLowerCase().trim()
  for (const [fieldName, keywords] of Object.entries(AUTO_DETECTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (
        normalizedHeader === keyword ||
        normalizedHeader.includes(keyword + " ") ||
        normalizedHeader.includes(" " + keyword)
      ) {
        return fieldName
      }
    }
  }
  return null
}

export function ColumnMapper({
  headers,
  entityType,
  mapping,
  onMappingChange,
  onContinue,
  onBack,
}: ColumnMapperProps) {
  const [showTable, setShowTable] = useState(true)

  const fields = useMemo(() => ENTITY_FIELDS[entityType] ?? [], [entityType])

  const initialMapping = useMemo(() => {
    const initial: ColumnMapping = { ...mapping }
    headers.forEach((header) => {
      if (!initial[header]) {
        const detected = detectField(header)
        if (detected) initial[header] = detected
      }
    })
    return initial
  }, [headers, mapping])

  const mappedFields = useMemo(() => {
    return new Set(Object.values(initialMapping).filter(Boolean))
  }, [initialMapping])

  const missingRequiredFields = useMemo(() => {
    const mappedFieldNames = new Set(Object.values(initialMapping))
    return fields
      .filter((f) => f.required && !mappedFieldNames.has(f.name))
      .map((f) => f.name)
  }, [fields, initialMapping])

  const unmappedHeaders = useMemo(
    () => headers.filter((h) => !initialMapping[h]),
    [headers, initialMapping]
  )

  const handleMappingChange = (spreadsheetColumn: string, fieldName: string) => {
    const newMapping = { ...initialMapping }
    if (fieldName === "_ignore_") {
      delete newMapping[spreadsheetColumn]
    } else {
      newMapping[spreadsheetColumn] = fieldName
    }
    onMappingChange(newMapping)
  }

  const handleAutoMap = () => {
    const newMapping: ColumnMapping = { ...initialMapping }
    headers.forEach((header) => {
      const detected = detectField(header)
      if (detected) newMapping[header] = detected
    })
    onMappingChange(newMapping)
  }

  const isValid = missingRequiredFields.length === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Mapeamento de Colunas
          </h3>
          <p className="text-sm text-neutral-500 mt-1">
            Associe cada coluna da planilha a um campo do sistema
          </p>
        </div>
        <button
          onClick={handleAutoMap}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          Auto-detectar
        </button>
      </div>

      <div className={cn(
        "p-4 rounded-xl border transition-colors",
        isValid
          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10"
          : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10"
      )}>
        <div className="flex items-center gap-3">
          {isValid ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          )}
          <div>
            <p className={cn(
              "font-medium",
              isValid ? "text-emerald-900 dark:text-emerald-100" : "text-amber-900 dark:text-amber-100"
            )}>
              {isValid
                ? "Todos os campos obrigatórios mapeados"
                : `${missingRequiredFields.length} campo(s) obrigatório(s) não mapeado(s)`}
            </p>
            {!isValid && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {missingRequiredFields.join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50 sticky top-0">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-neutral-600 dark:text-neutral-400">
                  Coluna do Arquivo
                </th>
                <th className="text-left py-3 px-4 font-medium text-neutral-600 dark:text-neutral-400">
                  Campo do Sistema
                </th>
                <th className="text-left py-3 px-4 font-medium text-neutral-600 dark:text-neutral-400 w-24">
                  Obrigatório
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {headers.map((header) => {
                const mappedField = initialMapping[header]
                const fieldDef = mappedField
                  ? fields.find((f) => f.name === mappedField)
                  : null

                return (
                  <tr key={header} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                    <td className="py-3 px-4 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                      {header}
                    </td>
                    <td className="py-3 px-4">
                      <Select
                        value={mappedField ?? "_ignore_"}
                        onValueChange={(value) => handleMappingChange(header, value)}
                      >
                        <SelectTrigger className="w-56 h-9 bg-white dark:bg-neutral-900">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_ignore_" className="text-neutral-400">
                            -- Ignorar --
                          </SelectItem>
                          {fields.map((field) => (
                            <SelectItem key={field.name} value={field.name}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-4">
                      {fieldDef?.required ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          Sim
                        </span>
                      ) : fieldDef ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400">
                          Não
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-400">--</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {unmappedHeaders.length > 0 && (
        <p className="text-sm text-neutral-500">
          <span className="text-amber-600 dark:text-amber-400">{unmappedHeaders.length}</span> coluna(s) não mapeada(s)
        </p>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <Button onClick={onContinue} disabled={!isValid} className="gap-2">
          Continuar
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}