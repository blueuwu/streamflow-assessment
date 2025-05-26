import Link from "next/link"
import Image from "next/image"

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-white dark:bg-gray-950 dark:border-gray-800">
      <div className="container flex flex-col gap-4 py-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Image 
            src="/streammflow-icon.png" 
            alt="Streamflow Logo" 
            width={24} 
            height={24} 
            className="rounded-full"
          />
          <span className="font-semibold">StreamflowAirdrop</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} StreamflowAirdrop. All rights reserved.
        </p>
        <nav className="flex items-center gap-4" aria-label="Footer navigation">
          <Link
            href="#"
            className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
          >
            Terms
          </Link>
          <Link
            href="#"
            className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
          >
            Privacy
          </Link>
          <Link
            href="#"
            className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
          >
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  )
}