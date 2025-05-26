import type React from "react"
import "@/app/globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import WalletContextProvider from "@/app/components/WalletProvider"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  icons: {
    icon: "/streammflow-icon.png",
  },
  title: "Streamflow",
  description: "Claim your token airdrops easily and securely",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <WalletContextProvider> 
            <Navbar />
            <div className="flex-grow">
              {children}
            </div>
            <Footer />
          </WalletContextProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
