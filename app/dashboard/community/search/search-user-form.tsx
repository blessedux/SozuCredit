"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
import Link from "next/link"

export function SearchUserForm() {
  const [searchTerm, setSearchTerm] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSearched(true)

    const supabase = createClient()

    try {
      // Search for users by email or display name
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .or(`email.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
        .limit(10)

      if (profiles && profiles.length > 0) {
        // Get business ideas for these users
        const userIds = profiles.map((p) => p.id)
        const { data: businesses } = await supabase.from("business_ideas").select("*").in("user_id", userIds)

        // Combine results
        const combined = profiles.map((profile) => ({
          ...profile,
          business: businesses?.find((b) => b.user_id === profile.id),
        }))

        setResults(combined)
      } else {
        setResults([])
      }
    } catch (error) {
      console.error("Search error:", error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="search">Email or Display Name</Label>
          <Input
            id="search"
            type="text"
            placeholder="john@example.com or John Doe"
            required
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Searching..." : "Search"}
        </Button>
      </form>

      {searched && (
        <div className="space-y-3">
          {results.length > 0 ? (
            results.map((result) => (
              <Card key={result.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{result.display_name}</p>
                      <p className="text-sm text-muted-foreground">{result.email}</p>
                      {result.business && (
                        <p className="mt-2 text-sm">
                          <span className="text-muted-foreground">Business:</span> {result.business.title}
                        </p>
                      )}
                    </div>
                    {result.business ? (
                      <Button asChild size="sm">
                        <Link href={`/dashboard/community/${result.business.id}`}>View Business</Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        No Business
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <p>No users found matching "{searchTerm}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
