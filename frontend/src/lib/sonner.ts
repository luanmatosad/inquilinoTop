import { toast } from 'sonner'

export const showToast = {
  success: (msg: string) =>
    toast.success(msg, {
      style: {
        borderLeft: '4px solid #22c55e',
      },
      duration: 3200,
    }),
  error: (msg: string) =>
    toast.error(msg, {
      style: {
        borderLeft: '4px solid var(--destructive)',
      },
      duration: 3200,
    }),
  neutral: (msg: string) =>
    toast(msg, {
      style: {
        borderLeft: '4px solid var(--primary)',
      },
      duration: 3200,
    }),
}
