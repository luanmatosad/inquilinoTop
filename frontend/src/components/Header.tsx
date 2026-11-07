import { TopBar } from '@/components/TopBar'

export default function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-12 w-full items-center justify-between gap-2 bg-sidebar px-4 py-2">
      <TopBar />
    </header>
  )
}
