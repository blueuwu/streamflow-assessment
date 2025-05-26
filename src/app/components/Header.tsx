'use client';

import Image from 'next/image';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css'; // Default styles for the button

const Header = () => {
  return (
    <header className="bg-blue-900 h-20 shadow-xl">
      <div className="h-full container mx-auto px-4 flex justify-between items-center">
        {/* Logo */}
        <div className="flex-1 flex justify-center">
          <div className="transform hover:scale-105 transition-transform duration-200">
            <Image
              src="/streammflow icon.png"
              alt="Streamflow Logo"
              width={80}
              height={80}
              className="rounded-lg"
              priority
            />
          </div>
        </div>

        {/* Wallet Button */}
        <div className="absolute right-8">
          <div className="hover:opacity-90 transition-opacity duration-200">
            <WalletMultiButton />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;