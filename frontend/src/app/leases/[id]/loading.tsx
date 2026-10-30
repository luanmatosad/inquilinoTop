import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="container py-8 space-y-4" aria-busy="true" aria-label="Carregando contrato">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-56 w-full" />
    </div>
  )
}
