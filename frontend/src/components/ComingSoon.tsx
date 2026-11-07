import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

type ComingSoonProps = {
  title: string
  description: string
}

/** Placeholder de módulo que tem item de menu no canvas mas ainda não tem tela. Sem dados nem API. */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold leading-[1.2]">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-start gap-2 py-6">
          <Badge variant="secondary">Em breve</Badge>
          <p className="text-sm text-muted-foreground">Esta área ainda está sendo preparada.</p>
        </CardContent>
      </Card>
    </div>
  )
}
