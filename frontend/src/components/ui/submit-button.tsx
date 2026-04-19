'use client'

import { useFormStatus } from 'react-dom'
import { Button, ButtonProps } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface SubmitButtonProps extends ButtonProps {
  text?: string
  loadingText?: string
}

export function SubmitButton({ 
  text = 'Enviar', 
  loadingText = 'Enviando...', 
  children, 
  disabled, 
  ...props 
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button disabled={pending || disabled} type="submit" {...props}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {pending ? loadingText : (children || text)}
    </Button>
  )
}
