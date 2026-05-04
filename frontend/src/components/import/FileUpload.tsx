"use client"

import { useState, useCallback } from "react"
import ExcelJS from "exceljs"
import Papa from "papaparse"
import { Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ParsedSpreadsheet {
  headers: string[]
  rows: string[][]
  fileName: string
}

interface FileUploadProps {
  onFileParsed: (data: ParsedSpreadsheet) => void
}

const MAX_ROWS = 10000
const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"]

export function FileUpload({ onFileParsed }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const validateFile = (file: File): string | null => {
    const extension = "." + file.name.split(".").pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return "Arquivo inválido. Use arquivo .xlsx ou .csv."
    }
    return null
  }

  const parseExcel = async (file: File): Promise<string[][]> => {
    const data = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(data)
    const worksheet = workbook.worksheets[0]
    if (!worksheet) return []
    const rows: string[][] = []
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = (row.values as (ExcelJS.CellValue | null)[]).slice(1)
      rows.push(
        values.map((cell) => {
          if (cell === null || cell === undefined) return ""
          if (cell instanceof Date) return cell.toISOString()
          if (typeof cell === "object" && "text" in cell) return String((cell as unknown as ExcelJS.CellRichTextValue).text ?? "")
          if (typeof cell === "object" && "result" in cell) return String((cell as unknown as ExcelJS.CellFormulaValue).result ?? "")
          return String(cell)
        })
      )
    })
    return rows
  }

  const parseCsv = (file: File): Promise<string[][]> =>
    new Promise((resolve, reject) => {
      Papa.parse<string[]>(file, {
        skipEmptyLines: true,
        complete: (result) => resolve(result.data),
        error: (err) => reject(err),
      })
    })

  const parseFile = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)
    setFileName(file.name)

    try {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }

      const extension = "." + file.name.split(".").pop()?.toLowerCase()
      const jsonData = extension === ".csv" ? await parseCsv(file) : await parseExcel(file)

      if (jsonData.length === 0) {
        setError("Arquivo vazio.")
        return
      }

      if (jsonData.length > MAX_ROWS + 1) {
        setError(`Arquivo muito grande. Máximo ${MAX_ROWS.toLocaleString()} linhas.`)
        return
      }

      const headers = jsonData[0].map((h) => String(h ?? ""))
      const rows = jsonData.slice(1).filter((row) => row.some((cell) => cell !== ""))

      onFileParsed({ headers, rows, fileName: file.name })
    } catch {
      setError("Erro ao processar arquivo. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }, [onFileParsed])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [parseFile])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }, [parseFile])

  if (fileName && !error && !isLoading) {
    return (
      <div className="relative p-6 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-emerald-900 dark:text-emerald-100 truncate">{fileName}</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Pronto para continuar</p>
          </div>
          <button
            onClick={() => { setFileName(null); setError(null) }}
            className="text-sm text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-300"
          >
            Alterar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300",
          isDragging
            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 scale-[1.02]"
            : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600",
          error ? "border-red-300 dark:border-red-800" : ""
        )}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:pointer-events-none"
          disabled={isLoading}
        />

        <div className="flex flex-col items-center gap-4">
          {isLoading ? (
            <>
              <div className="p-4 rounded-full bg-neutral-100 dark:bg-neutral-800">
                <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <div>
                <p className="font-medium text-neutral-900 dark:text-neutral-100">Processando arquivo...</p>
                <p className="text-sm text-neutral-500 mt-1">Isso pode levar alguns segundos</p>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 rounded-full bg-neutral-100 dark:bg-neutral-800 group-hover:scale-110 transition-transform duration-300">
                <Upload className="w-8 h-8 text-neutral-400" />
              </div>
              <div>
                <p className="font-medium text-neutral-700 dark:text-neutral-200">
                  <span className="text-blue-600 dark:text-blue-400">Clique para selecionar</span> ou arraste o arquivo
                </p>
                <p className="text-sm text-neutral-400 mt-1">
                  Excel (.xlsx, .xls) ou CSV • Máximo {MAX_ROWS.toLocaleString()} linhas
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}