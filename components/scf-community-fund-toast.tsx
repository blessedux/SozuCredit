"use client"

import { motion } from "framer-motion"

const SCF_COMMUNITY_FUND_URL = "https://communityfund.stellar.org"

type ScfCommunityFundToastProps = {
  visible?: boolean
}

export function ScfCommunityFundToast({ visible = true }: ScfCommunityFundToastProps) {
  if (!visible) return null

  return (
    <motion.a
      href={SCF_COMMUNITY_FUND_URL}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 12, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", damping: 26, stiffness: 280, delay: 0.8 }}
      className="fixed z-[45] block w-[7.5rem] shrink-0 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.45)] ring-1 ring-white/10 transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 md:hidden"
      style={{
        right: "max(0.75rem, env(safe-area-inset-right))",
        bottom: "max(5.5rem, calc(1rem + env(safe-area-inset-bottom)))",
      }}
      aria-label="Stellar Community Fund"
    >
      <img
        src="/SCFbanner.avif"
        alt=""
        className="block h-auto w-full rounded-xl object-cover"
        draggable={false}
      />
    </motion.a>
  )
}
