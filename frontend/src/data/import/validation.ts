export type ValidationError = {
  field: string
  message: string
  row?: number
}

export type ValidationResult = {
  isValid: boolean
  errors: ValidationError[]
}

export type FieldType = "string" | "number" | "cpf" | "cnpj" | "email" | "phone" | "date"

export interface FieldDefinition {
  name: string
  label: string
  type: FieldType
  required: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
}

export const ENTITY_FIELDS: Record<string, FieldDefinition[]> = {
  property: [
    { name: "name", label: "Nome", type: "string", required: true, minLength: 1, maxLength: 200 },
    { name: "type", label: "Tipo", type: "string", required: true },
    { name: "address_line", label: "Endereço", type: "string", required: false, maxLength: 500 },
    { name: "city", label: "Cidade", type: "string", required: false, maxLength: 100 },
    { name: "state", label: "Estado", type: "string", required: false, maxLength: 2 },
  ],
  tenant: [
    { name: "name", label: "Nome", type: "string", required: true, minLength: 1, maxLength: 200 },
    { name: "cpf", label: "CPF", type: "cpf", required: true },
    { name: "email", label: "Email", type: "email", required: false },
    { name: "phone", label: "Telefone", type: "phone", required: false },
  ],
  lease: [
    { name: "property_id", label: "ID do Imóvel", type: "string", required: true },
    { name: "tenant_id", label: "ID do Inquilino", type: "string", required: true },
    { name: "start_date", label: "Data de Início", type: "date", required: true },
    { name: "end_date", label: "Data de Término", type: "date", required: true },
    { name: "rent_amount", label: "Valor do Aluguel", type: "number", required: true, min: 0 },
  ],
}

function formatCPF(cpf: string): string {
  return cpf.replace(/\D/g, "")
}

function formatCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, "")
}

function formatPhone(phone: string): string {
  return phone.replace(/\D/g, "")
}

export function validateCPF(cpf: string): boolean {
  const cleaned = formatCPF(cpf)
  if (cleaned.length !== 11) return false

  if (/^(\d)\1+$/.test(cleaned)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i)
  }
  let digit1 = sum % 11
  digit1 = digit1 < 2 ? 0 : 11 - digit1

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i)
  }
  let digit2 = sum % 11
  digit2 = digit2 < 2 ? 0 : 11 - digit2

  return cleaned[9] === String(digit1) && cleaned[10] === String(digit2)
}

export function validateCNPJ(cnpj: string): boolean {
  const cleaned = formatCNPJ(cnpj)
  if (cleaned.length !== 14) return false

  if (/^(\d)\1+$/.test(cleaned)) return false

  let sum = 0
  let weight = 2
  for (let i = 11; i >= 0; i--) {
    sum += parseInt(cleaned[i]) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11)

  sum = 0
  weight = 2
  for (let i = 12; i >= 0; i--) {
    sum += parseInt(cleaned[i]) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11)

  return cleaned[12] === String(digit1) && cleaned[13] === String(digit2)
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePhone(phone: string): boolean {
  const cleaned = formatPhone(phone)
  return cleaned.length >= 10 && cleaned.length <= 11
}

export function validateDate(date: string): boolean {
  const parsed = new Date(date)
  return !isNaN(parsed.getTime())
}

export function validateField(
  value: string,
  field: FieldDefinition,
  rowIndex?: number
): ValidationError | null {
  const trimmed = value?.trim() ?? ""

  if (field.required && !trimmed) {
    return {
      field: field.name,
      message: `Campo obrigatório: ${field.label}`,
      row: rowIndex,
    }
  }

  if (!trimmed) {
    return null
  }

  switch (field.type) {
    case "cpf":
      if (!validateCPF(trimmed)) {
        return {
          field: field.name,
          message: `CPF inválido: ${value}`,
          row: rowIndex,
        }
      }
      break

    case "cnpj":
      if (!validateCNPJ(trimmed)) {
        return {
          field: field.name,
          message: `CNPJ inválido: ${value}`,
          row: rowIndex,
        }
      }
      break

    case "email":
      if (!validateEmail(trimmed)) {
        return {
          field: field.name,
          message: `Email inválido: ${value}`,
          row: rowIndex,
        }
      }
      break

    case "phone":
      if (!validatePhone(trimmed)) {
        return {
          field: field.name,
          message: `Telefone inválido: ${value}`,
          row: rowIndex,
        }
      }
      break

    case "date":
      if (!validateDate(trimmed)) {
        return {
          field: field.name,
          message: `Data inválida: ${value}`,
          row: rowIndex,
        }
      }
      break

    case "number":
      const num = parseFloat(trimmed)
      if (isNaN(num)) {
        return {
          field: field.name,
          message: `Valor numérico inválido: ${value}`,
          row: rowIndex,
        }
      }
      if (field.min !== undefined && num < field.min) {
        return {
          field: field.name,
          message: `Valor mínimo: ${field.min}`,
          row: rowIndex,
        }
      }
      if (field.max !== undefined && num > field.max) {
        return {
          field: field.name,
          message: `Valor máximo: ${field.max}`,
          row: rowIndex,
        }
      }
      break

    case "string":
      if (field.minLength !== undefined && trimmed.length < field.minLength) {
        return {
          field: field.name,
          message: `Mínimo ${field.minLength} caracteres`,
          row: rowIndex,
        }
      }
      if (field.maxLength !== undefined && trimmed.length > field.maxLength) {
        return {
          field: field.name,
          message: `Máximo ${field.maxLength} caracteres`,
          row: rowIndex,
        }
      }
      if (field.pattern && !field.pattern.test(trimmed)) {
        return {
          field: field.name,
          message: `Formato inválido para ${field.label}`,
          row: rowIndex,
        }
      }
      break
  }

  return null
}

export function validateRow(
  row: Record<string, string>,
  fields: FieldDefinition[],
  rowIndex?: number
): ValidationResult {
  const errors: ValidationError[] = []

  for (const field of fields) {
    const value = row[field.name] ?? ""
    const error = validateField(value, field, rowIndex)
    if (error) {
      errors.push(error)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export function validateDataset(
  rows: Record<string, string>[],
  entityType: string
): ValidationResult[] {
  const fields = ENTITY_FIELDS[entityType] ?? []
  return rows.map((row, index) => validateRow(row, fields, index))
}