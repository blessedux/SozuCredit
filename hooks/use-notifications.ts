/**
 * Custom hook for notifications functionality
 * Handles notifications fetching, marking as read, and unread count
 */

import { useState, useCallback, useEffect, useRef } from "react"
import { getUserId } from "@/lib/wallet-utils"

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  created_at: string
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const previousUnreadCountRef = useRef(0)

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    const userId = getUserId()
    if (!userId) return

    try {
      const notificationsResponse = await fetch("/api/wallet/notifications", {
        headers: {
          "x-user-id": userId,
        },
      })

      if (notificationsResponse.ok) {
        const notificationsData = await notificationsResponse.json()
        const newNotifications = notificationsData.notifications || []
        const previousUnreadCount = previousUnreadCountRef.current
        setNotifications(newNotifications)
        const unread = newNotifications.filter((n: Notification) => !n.read).length
        setUnreadCount(unread)
        previousUnreadCountRef.current = unread

        // Play notification sound if there are new unread notifications
        if (unread > previousUnreadCount && typeof window !== "undefined") {
          try {
            const audio = new Audio("/sound/KREAEM_percussion_one_shot_falling_wood.wav")
            audio.volume = 0.3
            audio.play().catch(err => console.log("[Notifications] Could not play notification sound:", err))
          } catch (err) {
            console.log("[Notifications] Error creating notification sound:", err)
          }
        }
      }
    } catch (error) {
      console.error("[Notifications] Error fetching notifications:", error)
    }
  }, [])

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    const userId = getUserId()
    if (!userId) return

    try {
      await fetch("/api/wallet/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          notificationId,
          read: true,
        }),
      })

      // Update local state
      setNotifications(prev => prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      ))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error("[Notifications] Error marking notification as read:", error)
    }
  }, [])

  // Initialize notifications on mount
  useEffect(() => {
    fetchNotifications()

    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
  }
}
