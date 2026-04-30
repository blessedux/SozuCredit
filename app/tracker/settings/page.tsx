import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function TrackerSettingsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Settings</h2>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
          <CardDescription>Currency, default category, and more (coming soon)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Budget limits, bank link, and export options will appear here in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
