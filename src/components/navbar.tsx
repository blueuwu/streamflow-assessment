"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ConnectWalletButton } from "@/components/connect-wallet-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import { PublicKey } from "@solana/web3.js"

export function Navbar() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const router = useRouter()

  const validatePublicKey = (input: string): boolean => {
    try {
      new PublicKey(input)
      return true
    } catch {
      return false
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedValue = searchValue.trim()
    
    if (!trimmedValue) return
    
    if (validatePublicKey(trimmedValue)) {
      router.push(`/airdrop/${encodeURIComponent(trimmedValue)}`)
      setSearchValue("")
      setIsSearchOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchValue("")
      setIsSearchOpen(false)
    }
  }

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-950/80 dark:border-gray-800 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/streammflow-icon.png" alt="Streamflow Logo" width={32} height={32} className="rounded-full" />
          <span className="font-bold text-xl">Streamflow</span>
        </Link>
        
        <div className="flex items-center gap-3">
          {/* Quick Search */}
          <div className="hidden md:flex items-center">
            {isSearchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Enter Airdrop ID..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-64 h-9 text-sm pr-8"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchValue("")
                      setIsSearchOpen(false)
                    }}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <Button 
                  type="submit" 
                  size="sm"
                  disabled={!searchValue.trim() || !validatePublicKey(searchValue.trim())}
                  className="h-9"
                >
                  Go
                </Button>
              </form>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                <span className="hidden lg:inline">Search</span>
              </Button>
            )}
          </div>

          {/* Mobile Search Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="md:hidden"
          >
            <Search className="h-4 w-4" />
          </Button>

          <ThemeToggle />
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  )
}