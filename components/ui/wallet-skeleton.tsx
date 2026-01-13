"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Award, Wallet } from "lucide-react"
import { motion } from "framer-motion"

interface WalletSkeletonProps {
  isExiting?: boolean
}

export function WalletSkeleton({ isExiting = false }: WalletSkeletonProps) {
  return (
    <motion.div
      className="relative h-full w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="container mx-auto px-6 py-8 md:py-12">
        {/* Balance Display Box Skeleton */}
        <div className="mb-8 relative">
          <div className="border border-white/20 rounded-lg p-8 text-center relative">
            {/* Label skeleton */}
            <Skeleton className="h-4 w-32 mx-auto mb-4 bg-white/10" />
            
            {/* Balance number skeleton */}
            <div className="flex items-center justify-center min-h-[4rem]">
              <Skeleton className="h-16 w-48 bg-white/10" />
            </div>
            
            {/* APY badge skeleton */}
            <div className="mt-2 flex justify-center">
              <Skeleton className="h-6 w-20 bg-white/10 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Elements Skeleton - Fixed position matching wallet page */}
      {/* Trust Points - Bottom Left */}
      <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-10">
        <div className="px-5 py-3 md:px-4 md:py-2 flex items-center gap-2 md:gap-2">
          <Award className="w-6 h-6 md:w-5 md:h-5 text-white/30" />
          <Skeleton className="h-5 w-20 bg-white/10" />
        </div>
      </div>

      {/* Wallet Icon - Bottom Right */}
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-10">
        <div className="w-16 h-16 md:w-14 md:h-14 flex items-center justify-center">
          <Wallet className="w-7 h-7 md:w-6 md:h-6 text-white/30" />
        </div>
      </div>
    </motion.div>
  )
}
