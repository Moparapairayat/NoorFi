import { getMe } from './auth';
import { getTransactions } from './transactions';
import { getWallets } from './wallets';

export async function warmupSessionData(
  options: { forceRefresh?: boolean } = {}
): Promise<void> {
  const forceRefresh = options.forceRefresh === true;

  await Promise.allSettled([
    getMe({ forceRefresh }),
    getWallets({ forceRefresh }),
    getTransactions({ perPage: 10, forceRefresh }),
  ]);
}
