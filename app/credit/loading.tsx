import { cn } from "@/lib/utils"

export default function CreditLoading() {
  const skeletonClass =
    "rounded-2xl border border-white/15 bg-black/45 shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl backdrop-saturate-150 animate-pulse"

  return (
    <div className="relative z-10 min-h-screen bg-transparent px-4 pt-[max(5rem,env(safe-area-inset-top))] pb-24">
      <div className="mx-auto max-w-lg space-y-4">
        <div className={cn(skeletonClass, "h-10 w-48")} />
        <div className={cn(skeletonClass, "h-24")} />
        <div className={cn(skeletonClass, "h-32")} />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={cn(skeletonClass, "h-40")} />
          ))}
        </div>
      </div>
    </div>
  )
}
