"use client"

import { useState } from "react"
import { FileUpload, ParsedSpreadsheet } from "@/components/import/FileUpload"
import { ColumnMapper, ColumnMapping } from "@/components/import/ColumnMapper"
import { ImportPreview } from "@/components/import/ImportPreview"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { goFetch } from "@/lib/go/client"
import { toast } from "sonner"
import { 
  Upload, 
  ArrowRight, 
  CheckCircle2, 
  Building2, 
  Users, 
  FileText,
  History,
  Sparkles
} from "lucide-react"
import { cn } from "@/lib/utils"

type ImportStep = "entity" | "upload" | "mapping" | "preview" | "done"

type EntityType = "property" | "tenant" | "lease"

const ENTITY_OPTIONS: { value: EntityType; label: string; description: string; icon: React.ElementType }[] = [
  { 
    value: "property", 
    label: "Imóveis", 
    description: "Nome, tipo, endereço, cidade, estado",
    icon: Building2 
  },
  { 
    value: "tenant", 
    label: "Inquilinos", 
    description: "Nome, CPF, email, telefone",
    icon: Users 
  },
  { 
    value: "lease", 
    label: "Contratos", 
    description: "ID do imóvel, inquilino, datas, valor",
    icon: FileText 
  },
]

const STEPS = [
  { key: "entity", label: "Entidade", short: "1" },
  { key: "upload", label: "Arquivo", short: "2" },
  { key: "mapping", label: "Mapeamento", short: "3" },
  { key: "preview", label: "Preview", short: "4" },
  { key: "done", label: "Concluído", short: "5" },
]

export default function ImportPage() {
  const [step, setStep] = useState<ImportStep>("entity")
  const [entityType, setEntityType] = useState<EntityType>("property")
  const [spreadsheet, setSpreadsheet] = useState<ParsedSpreadsheet | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "update" | "create">("skip")
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null)

  const handleFileParsed = (data: ParsedSpreadsheet) => {
    setSpreadsheet(data)
    setMapping({})
    setStep("mapping")
  }

  const handleImport = async () => {
    if (!spreadsheet) return

    setIsImporting(true)
    try {
      const records = spreadsheet.rows.map((row) => {
        const record: Record<string, string> = {}
        spreadsheet.headers.forEach((header, colIndex) => {
          const fieldName = mapping[header]
          if (fieldName) record[fieldName] = row[colIndex] ?? ""
        })
        return record
      })

      const response = await goFetch<{ data: { imported: number; failed: number } }>(
        "/api/v1/import",
        {
          method: "POST",
          body: JSON.stringify({
            entity_type: entityType,
            records,
            duplicate_strategy: duplicateStrategy,
          }),
        }
      )

      setImportResult({ imported: response.data.imported, failed: response.data.failed })
      toast.success(`Importação concluída: ${response.data.imported} registros`)
      setStep("done")
    } catch {
      toast.error("Erro na importação. Tente novamente.")
    } finally {
      setIsImporting(false)
    }
  }

  const handleReset = () => {
    setStep("entity")
    setSpreadsheet(null)
    setMapping({})
    setImportResult(null)
  }

  const currentStepIndex = STEPS.findIndex(s => s.key === step)

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Importação em Lote
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            Importador de Planilhas
          </h1>
          <p className="text-neutral-500 mt-2">
            Importe dados de planilhas Excel ou CSV para o sistema
          </p>
        </div>

        <div className="flex items-center justify-center gap-1 mb-10">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all",
                  i < currentStepIndex
                    ? "bg-blue-600 text-white"
                    : i === currentStepIndex
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                )}
              >
                {i < currentStepIndex ? <CheckCircle2 className="w-4 h-4" /> : s.short}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "w-8 h-0.5 mx-1",
                  i < currentStepIndex ? "bg-blue-600" : "bg-neutral-200 dark:bg-neutral-700"
                )} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          {step === "entity" && (
            <div className="p-8">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Selecione o tipo de dados
              </h2>
              <p className="text-neutral-500 mb-6">
                Escolha qual tipo de informação você deseja importar
              </p>

              <div className="grid gap-3">
                {ENTITY_OPTIONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        setEntityType(option.value)
                        setStep("upload")
                      }}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:border-blue-300 dark:hover:border-blue-700",
                        entityType === option.value
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                          : "border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      )}
                    >
                      <div className={cn(
                        "p-3 rounded-lg",
                        entityType === option.value
                          ? "bg-blue-100 dark:bg-blue-900/30"
                          : "bg-neutral-100 dark:bg-neutral-800"
                      )}>
                        <Icon className={cn(
                          "w-6 h-6",
                          entityType === option.value
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-neutral-500"
                        )} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">
                          {option.label}
                        </p>
                        <p className="text-sm text-neutral-500">{option.description}</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-neutral-300" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === "upload" && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setStep("entity")}
                  className="text-sm text-neutral-500 hover:text-neutral-700"
                >
                  Voltar
                </button>
                <span className="text-neutral-300">•</span>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Upload do Arquivo
                </h2>
              </div>
              
              <FileUpload onFileParsed={handleFileParsed} />
            </div>
          )}

          {step === "mapping" && spreadsheet && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setStep("upload")}
                  className="text-sm text-neutral-500 hover:text-neutral-700"
                >
                  Voltar
                </button>
                <span className="text-neutral-300">•</span>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Mapeamento de Colunas
                </h2>
              </div>

              <ColumnMapper
                headers={spreadsheet.headers}
                entityType={entityType}
                mapping={mapping}
                onMappingChange={setMapping}
                onContinue={() => setStep("preview")}
                onBack={() => setStep("upload")}
              />
            </div>
          )}

          {step === "preview" && spreadsheet && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setStep("mapping")}
                  className="text-sm text-neutral-500 hover:text-neutral-700"
                >
                  Voltar
                </button>
                <span className="text-neutral-300">•</span>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Preview
                </h2>
              </div>

              <ImportPreview
                spreadsheet={spreadsheet}
                entityType={entityType}
                mapping={mapping}
                onMappingChange={setMapping}
                onImport={handleImport}
                onBack={() => setStep("mapping")}
                isImporting={isImporting}
                duplicateStrategy={duplicateStrategy}
                onDuplicateStrategyChange={setDuplicateStrategy}
              />
            </div>
          )}

          {step === "done" && importResult && (
            <div className="p-12 text-center">
              <div className="inline-flex p-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-6">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
              </div>
              
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                Importação Concluída!
              </h2>
              <p className="text-neutral-500 mb-8">
                Os dados foram importados com sucesso.
              </p>

              <div className="flex justify-center gap-8 mb-8">
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {importResult.imported}
                  </p>
                  <p className="text-sm text-neutral-500">Importados</p>
                </div>
                {importResult.failed > 0 && (
                  <div className="text-center">
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {importResult.failed}
                    </p>
                    <p className="text-sm text-neutral-500">Falharam</p>
                  </div>
                )}
              </div>

              <Button onClick={handleReset} className="gap-2">
                <Upload className="w-4 h-4" />
                Importar Novamente
              </Button>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <button className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700">
            <History className="w-4 h-4" />
            Ver histórico de importações
          </button>
        </div>
      </div>
    </div>
  )
}