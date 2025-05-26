'use client';

import React, { FC, useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
    PhantomWalletAdapter,
    // Add other wallets you want to support here
    // SolflareWalletAdapter,
    // TorusWalletAdapter,
    // LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // Added QueryClient imports

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

type WalletProviderProps = {
    children: React.ReactNode;
};

// Create a new QueryClient instance
// It's good practice to create this once and provide it.
const queryClient = new QueryClient();

const WalletContextProvider: FC<WalletProviderProps> = ({ children }) => {
    // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
    const network = WalletAdapterNetwork.Devnet; // Or MainnetBeta, Testnet

    // You can also provide a custom RPC endpoint.
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            // Add other wallet adapters here if needed
            // new SolflareWalletAdapter({ network }),
            // new TorusWalletAdapter(),
            // new LedgerWalletAdapter(),
        ],
        []
    );

    return (
        <QueryClientProvider client={queryClient}> {/* Added QueryClientProvider */}
            <ConnectionProvider endpoint={endpoint}>
                <SolanaWalletProvider wallets={wallets} autoConnect>
                    <WalletModalProvider>
                        {children}
                    </WalletModalProvider>
                </SolanaWalletProvider>
            </ConnectionProvider>
        </QueryClientProvider>
    );
};

export default WalletContextProvider;