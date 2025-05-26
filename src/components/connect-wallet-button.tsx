"use client"

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { WalletIcon } from 'lucide-react'; // Using WalletIcon for the placeholder

// Dynamically import WalletMultiButton with SSR disabled
const DynamicWalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  {
    ssr: false,
    loading: () => ( // Placeholder while the actual button is loading
      <button
        style={{
          backgroundColor: "rgb(37 99 235 / 0.5)", // Lighter blue for loading
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: '1rem',
          paddingRight: '1rem',
          paddingTop: '0.5rem',
          paddingBottom: '0.5rem',
          borderRadius: '0.375rem',
          color: 'white',
          fontWeight: '500',
          fontSize: '0.875rem',
          cursor: 'default', // Indicate it's not interactive yet
        }}
        disabled
      >
        <WalletIcon className="mr-2 h-4 w-4" /> Loading Wallet...
      </button>
    )
  }
);

export function ConnectWalletButton() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    // Render a styled placeholder button on the server and before client-side mount
    // This helps prevent layout shifts and provides immediate feedback
    return (
      <button
        style={{
          backgroundColor: "rgb(37 99 235)", // Corresponds to blue-600
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: '1rem',
          paddingRight: '1rem',
          paddingTop: '0.5rem',
          paddingBottom: '0.5rem',
          borderRadius: '0.375rem', // Corresponds to rounded-md
          color: 'white',
          fontWeight: '500', // Corresponds to font-medium
          fontSize: '0.875rem', // Corresponds to text-sm
        }}
        disabled // Disabled as it's just a placeholder
      >
        <WalletIcon className="mr-2 h-4 w-4" /> Connect Wallet
      </button>
    );
  }

  // Render the actual WalletMultiButton only on the client-side after mounting
  return (
    <DynamicWalletMultiButton
      style={{
        backgroundColor: "rgb(37 99 235)", // Corresponds to blue-600
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',
        borderRadius: '0.375rem', // Corresponds to rounded-md
        color: 'white',
        fontWeight: '500', // Corresponds to font-medium
        fontSize: '0.875rem', // Corresponds to text-sm
      }}
    />
  );
}
