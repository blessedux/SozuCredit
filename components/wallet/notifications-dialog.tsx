/**
 * Notifications dialog component
 * Displays notifications list with mark as read functionality
 */

"use client"

import { memo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useWalletLanguage } from "@/lib/wallet-language"
import type { Notification } from "@/hooks/use-notifications"

interface NotificationsDialogProps {
  isOpen: boolean
  onClose: () => void
  notifications: Notification[]
  unreadCount: number
  onMarkAsRead: (notificationId: string) => void
}

export const NotificationsDialog = memo(function NotificationsDialog({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
}: NotificationsDialogProps) {
  const { t } = useWalletLanguage()
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-black/80 backdrop-blur-md border-white/20 text-white max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl">{t.notifications}</DialogTitle>
          <DialogDescription className="text-white/60">
            {unreadCount > 0 ? `${unreadCount} ${t.unreadNotifications}` : t.noNotifications}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {notifications.length === 0 ? (
            <p className="text-white/60 text-center py-8">{t.noNotifications}</p>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border cursor-pointer ${
                  notification.read
                    ? "bg-white/5 border-white/10"
                    : "bg-white/10 border-white/20"
                }`}
                onClick={() => {
                  if (!notification.read) {
                    onMarkAsRead(notification.id)
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-white">{notification.title}</h4>
                    <p className="text-sm text-white/80 mt-1">{notification.message}</p>
                    <p className="text-xs text-white/60 mt-2">
                      {new Date(notification.created_at).toLocaleDateString()} {new Date(notification.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 mt-1" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
})
