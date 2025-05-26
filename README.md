# StreamFlow Airdrop App

A simple web app for claiming StreamFlow airdrops on Solana. Connect your Phantom wallet to view available airdrops and claim your tokens.

## Features

- Connect your Phantom wallet
- Browse recent available airdrops
- View airdrop details (type, recipients, amounts)
- Check your eligibility and allocation
- Claim your tokens directly from the app

## Tech Stack

Built with React, Next.js, TypeScript, and Tailwind CSS. Uses the StreamFlow JS SDK and Solana wallet adapter.

## Getting Started

You'll need Node.js 18+ and the Phantom wallet extension.

```bash
npm install
npm run dev
```

The app will run at http://localhost:3000

Make sure your Phantom wallet is set to Devnet. You can get free devnet SOL from a Solana faucet if needed.

## Future Improvements

- Advanced search and filtering options
- Sorting by different criteria (amount, date, etc.)
- USD value display for token amounts
- Claim history tracking
- Push notifications for new airdrops

## Main Files

Here's what the key files in the project do:

**src/app/page.tsx** - This is the main home page where users see the latest airdrops and can search for specific ones. It shows a grid of airdrop cards and handles loading states.

**src/lib/streamflow.ts** - The core file that talks to the StreamFlow API. It handles fetching airdrop data, checking user eligibility, and processing claims.

**src/components/airdrops-grid.tsx** - Creates the table layout that displays airdrop cards on the home page. Each card shows basic info like the airdrop name, amount, and claim status.

**src/components/navbar.tsx** - The top navigation bar with the wallet connection button and theme toggle. It shows the user's wallet address when connected.

**src/app/airdrop/[id]/page.tsx** - The detailed page for individual airdrops where users can see full details and claim their tokens if eligible.

**src/hooks/useGetAirdropsQuery.ts** - A React Query hook that manages fetching airdrop data from the API. It handles caching, loading states, and retries.

**src/lib/error-handler.ts** - Utilities for handling errors gracefully throughout the app. It includes retry logic and proper error messaging.

**src/types/errors.ts** - TypeScript definitions for different error types that can occur when interacting with the StreamFlow API.

## Resources

- [StreamFlow JS SDK](https://docs.streamflow.finance/SDKs/js-sdk/overview)
- [StreamFlow API Docs](https://docs.streamflow.finance/API/public-api/overview)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
