import React, { createContext, useContext, useMemo, useState } from 'react';

export type WalletId = 'usd' | 'usdt' | 'sol';
export type FundingSourceId = 'usd_wallet' | 'usdt_wallet' | 'sol_wallet';

type WalletOption = {
  id: WalletId;
  shortLabel: 'USD' | 'USDT' | 'SOL';
  fullLabel: string;
  unit: string;
  decimals: number;
  usdRate: number;
};

type WalletContextValue = {
  selectedWallet: WalletId;
  setSelectedWallet: (wallet: WalletId) => void;
  wallets: WalletOption[];
  formatFromUsd: (usdAmount: number, signed?: boolean) => string;
  formatNative: (amount: number, signed?: boolean) => string;
  currentFundingSource: FundingSourceId;
};

const wallets: WalletOption[] = [
  {
    id: 'usd',
    shortLabel: 'USD',
    fullLabel: 'USD Wallet',
    unit: 'USD',
    decimals: 2,
    usdRate: 1,
  },
  {
    id: 'usdt',
    shortLabel: 'USDT',
    fullLabel: 'USDT Wallet',
    unit: 'USDT',
    decimals: 2,
    usdRate: 1,
  },
  {
    id: 'sol',
    shortLabel: 'SOL',
    fullLabel: 'SOL Wallet',
    unit: 'SOL',
    decimals: 4,
    usdRate: 170,
  },
];

function formatNumber(value: number, decimals: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

function walletIdToFundingSource(walletId: WalletId): FundingSourceId {
  if (walletId === 'usdt') return 'usdt_wallet';
  if (walletId === 'sol') return 'sol_wallet';
  return 'usd_wallet';
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [selectedWallet, setSelectedWallet] = useState<WalletId>('usd');

  const value = useMemo<WalletContextValue>(() => {
    const wallet = wallets.find((item) => item.id === selectedWallet) ?? wallets[0];

    const formatNative = (amount: number, signed = false): string => {
      const abs = Math.abs(amount);
      const sign = signed ? (amount < 0 ? '-' : '+') : '';

      return `${sign}${wallet.unit} ${formatNumber(abs, wallet.decimals)}`;
    };

    const formatFromUsd = (usdAmount: number, signed = false): string => {
      const converted = usdAmount / wallet.usdRate;
      return formatNative(converted, signed);
    };

    return {
      selectedWallet,
      setSelectedWallet,
      wallets,
      formatFromUsd,
      formatNative,
      currentFundingSource: walletIdToFundingSource(selectedWallet),
    };
  }, [selectedWallet]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used inside WalletProvider');
  }

  return context;
}
