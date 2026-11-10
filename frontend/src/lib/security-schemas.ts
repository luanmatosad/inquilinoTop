import { z } from 'zod'

// Mesma regra de tamanho do cadastro (mínimo 8); o backend confere a senha atual.
export const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Informe a senha atual.'),
    new_password: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres.'),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, { path: ['confirm_password'], message: 'A confirmação não confere com a nova senha.' })
  .refine((v) => v.new_password !== v.current_password, { path: ['new_password'], message: 'A nova senha deve ser diferente da atual.' })

export type PasswordValues = z.infer<typeof passwordSchema>

export const twoFactorCodeSchema = z.string().regex(/^\d{6}$/, 'Informe os 6 dígitos do aplicativo.')
