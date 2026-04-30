import { TrackerNav } from "./tracker-nav"

export default function TrackerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="sticky top-0 z-10 shrink-0 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-semibold">Expense Tracker</h1>
      </header>
      <main className="min-h-0 flex-1 px-4 py-4">{children}</main>
      <TrackerNav />
    </div>
  )
}
