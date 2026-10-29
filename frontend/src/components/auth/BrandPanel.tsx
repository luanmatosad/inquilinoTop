import Image from 'next/image'

export function BrandPanel() {
  return (
    <div className="relative hidden md:block overflow-hidden bg-primary">
      <Image
        src="/login/photo2.png"
        alt="Pessoa usando o ImoviFlow em um notebook"
        fill
        priority
        quality={90}
        sizes="50vw"
        className="object-cover object-top"
      />
      <Image
        src="/login/vector.svg"
        alt=""
        fill
        sizes="50vw"
        className="object-cover pointer-events-none"
      />
      <p className="absolute left-8 top-8 lg:left-12 lg:top-12 max-w-[48%] font-semibold leading-[0.95] text-primary-foreground text-[clamp(2.25rem,7.3vw,6.875rem)]">
        Menos planilhas. Mais controle.
      </p>
    </div>
  )
}
