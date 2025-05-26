"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function SearchAirdrop() {
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-3xl mx-auto">
      <div className="flex w-full max-w-2xl items-center space-x-2">
        <Input
          type="text"
          placeholder="Enter Airdrop ID"
          className="flex-1 h-12 text-lg px-4 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-2 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
        />
        <Button type="submit" size="lg" className="h-12 px-6 text-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
          Search
        </Button>
      </div>
    </div>
  )
}
