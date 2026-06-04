"use client"

import { useRouter } from "next/navigation"
import { AccountSettingsContent } from "@/components/settings/account-settings-content"

export default function ProfileSettingsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-transparent text-white">
      <AccountSettingsContent onBack={() => router.push("/home?panel=settings")} />
    </div>
  )
}
