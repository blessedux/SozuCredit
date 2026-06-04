import { cn } from "@/lib/utils"

type SozuShaderAvatarProps = {
  className?: string
  children?: React.ReactNode
}

/** Lightweight CSS-only avatar using the same orange orb palette as the app background. */
export function SozuShaderAvatar({ className, children }: SozuShaderAvatarProps) {
  return (
    <div className={cn("sozu-shader-avatar flex items-center justify-center", className)}>
      {children ? <span className="relative z-[1]">{children}</span> : null}
    </div>
  )
}
