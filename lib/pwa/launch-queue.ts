export type PwaLaunchParams = {
  targetURL?: string
}

export type PwaLaunchQueue = {
  setConsumer: (callback: (params: PwaLaunchParams) => void) => void
}

/** Same-origin path+search+hash from a PWA launch URL, or null. */
export function sameOriginPathFromLaunchUrl(
  targetURL: string,
  currentOrigin: string,
): string | null {
  try {
    const url = new URL(targetURL)
    if (url.origin !== currentOrigin) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

/**
 * Installed PWAs with launch_handler focus-existing receive the scanned URL on
 * LaunchQueue instead of navigating. Apply it so /auth?return_to= reaches pizza hop.
 */
export function consumePwaLaunchQueue(opts: {
  launchQueue: PwaLaunchQueue | null | undefined
  currentOrigin: string
  currentHref: string | (() => string)
  navigate: (pathWithSearch: string) => void
}): void {
  if (!opts.launchQueue?.setConsumer) return

  opts.launchQueue.setConsumer((params) => {
    if (!params.targetURL) return
    const next = sameOriginPathFromLaunchUrl(params.targetURL, opts.currentOrigin)
    if (!next) return
    const href =
      typeof opts.currentHref === "function" ? opts.currentHref() : opts.currentHref
    try {
      const current = new URL(href)
      const currentPath = `${current.pathname}${current.search}${current.hash}`
      if (next === currentPath) return
    } catch {
      /* navigate anyway */
    }
    opts.navigate(next)
  })
}
