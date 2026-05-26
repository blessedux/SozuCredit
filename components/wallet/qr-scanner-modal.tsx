"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import jsQR from "jsqr"
import { X, Camera, CameraOff } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface QrScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScan: (value: string) => void
}

export function QrScannerModal({ isOpen, onClose, onScan }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setScanning(false)
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setScanning(true)
      }
    } catch {
      setError("Camera access denied. Please allow camera permissions and try again.")
    }
  }, [])

  // Scan loop — runs every animation frame when camera is active
  useEffect(() => {
    if (!scanning) return

    const tick = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      })

      if (code?.data) {
        stopCamera()
        onScan(code.data)
        onClose()
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [scanning, onScan, onClose, stopCamera])

  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [isOpen, startCamera, stopCamera])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { stopCamera(); onClose() } }}>
      <DialogContent className="bg-black/90 backdrop-blur-md border-white/20 text-white max-w-sm p-0 overflow-hidden rounded-2xl">
        <div className="relative w-full aspect-square">
          {/* Video feed */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Hidden canvas for QR decoding */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Scan overlay */}
          {scanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Corner brackets */}
              <div className="relative w-52 h-52">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-sm" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-sm" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-sm" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-sm" />
                {/* Scan line */}
                <div className="absolute left-2 right-2 h-px bg-white/70 animate-scan-line" />
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6">
              <CameraOff className="w-10 h-10 text-white/50" />
              <p className="text-white/70 text-sm text-center leading-relaxed">{error}</p>
              <button
                onClick={startCamera}
                className="flex items-center gap-2 text-white text-sm bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-lg"
              >
                <Camera className="w-4 h-4" />
                Try again
              </button>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={() => { stopCamera(); onClose() }}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 transition-colors"
            aria-label="Close camera"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Label */}
        <div className="py-4 text-center">
          <p className="text-white/60 text-sm">Point your camera at a Sozu QR code</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
