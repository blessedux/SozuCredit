import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScanLine } from "lucide-react"

export default function TrackerScanPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Scan receipt</h2>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">OCR receipt scanning</CardTitle>
          <CardDescription>Coming in Phase 2</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="flex size-20 items-center justify-center rounded-full bg-muted">
            <ScanLine className="size-10 text-muted-foreground" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Upload a photo or screenshot of a receipt to auto-fill merchant, date, and total. You can add expenses manually for now.
          </p>
          <Button asChild>
            <Link href="/tracker/expenses/new">Add expense manually</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
