"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { QrCode } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export function WithdrawQRForm({ vaultId, currentBalance }: { vaultId: string; currentBalance: number }) {
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [scannedAlias, setScannedAlias] = useState("")

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-8">
        <QrCode className="h-16 w-16 text-muted-foreground" />
        <div className="text-center">
          <p className="font-medium">Scan Recipient's QR Code</p>
          <p className="text-sm text-muted-foreground">Use your camera to scan their vault QR code</p>
        </div>
        <Button variant="outline">Open Camera</Button>
      </div>

      {scannedAlias && (
        <div className="rounded-lg bg-primary/10 p-4 text-center">
          <p className="text-sm text-muted-foreground">Scanned Alias</p>
          <p className="font-mono font-semibold">{scannedAlias}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="qr-amount">Amount ($)</Label>
        <Input
          id="qr-amount"
          type="number"
          placeholder="50.00"
          required
          min="0.01"
          step="0.01"
          max={currentBalance}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={!scannedAlias}
        />
        <p className="text-xs text-muted-foreground">Available: ${currentBalance.toFixed(2)}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="qr-description">Description (Optional)</Label>
        <Textarea
          id="qr-description"
          placeholder="e.g., Payment for services, Gift..."
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={!scannedAlias}
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1 bg-transparent" asChild>
          <Link href="/dashboard/vault">Cancel</Link>
        </Button>
        <Button type="submit" className="flex-1" disabled={!scannedAlias}>
          Send Funds
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        QR scanning requires camera permissions. For now, you can use the "By Alias" method.
      </p>
    </div>
  )
}
