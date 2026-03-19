import { apiRequest } from './client';

export type WalletCurrency = 'USD' | 'USDT' | 'SOL';
export type WalletCurrencyLower = 'usd' | 'usdt' | 'sol';

export type WalletSummaryResponse = {
  summary: {
    total_usd_value: number;
    wallet_count: number;
  };
  wallets: Array<{
    id: number;
    currency: WalletCurrency;
    balance: number;
    locked_balance: number;
    is_active: boolean;
    usd_value: number;
    updated_at: string | null;
  }>;
};

export async function getWallets(
  options: { forceRefresh?: boolean } = {}
): Promise<WalletSummaryResponse> {
  return apiRequest<WalletSummaryResponse>('/wallets', {
    method: 'GET',
    cacheTtlMs: 12_000,
    forceRefresh: options.forceRefresh,
  });
}

export async function resolveWalletIdByCurrency(
  currency: WalletCurrencyLower
): Promise<number> {
  const response = await getWallets();
  const wallet = response.wallets.find((item) => item.currency.toLowerCase() === currency);

  if (!wallet) {
    throw new Error(`Wallet not found for currency ${currency.toUpperCase()}.`);
  }

  return wallet.id;
}
