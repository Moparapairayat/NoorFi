import { apiRequest } from './client';

export type TransactionRecord = {
  id: number;
  wallet_id: number | null;
  currency: string;
  type: string;
  direction: 'credit' | 'debit';
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  reference: string;
  description: string | null;
  related_type: string | null;
  related_id: number | null;
  occurred_at: string | null;
  created_at: string | null;
  meta?: Record<string, unknown>;
};

type PaginatedResponse<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

type TransactionQuery = {
  walletId?: number;
  type?: string;
  direction?: 'credit' | 'debit';
  status?: string;
  search?: string;
  perPage?: number;
  forceRefresh?: boolean;
};

export async function getTransactions(
  query: TransactionQuery = {}
): Promise<PaginatedResponse<TransactionRecord>> {
  const params = new URLSearchParams();

  if (query.walletId) {
    params.append('wallet_id', String(query.walletId));
  }
  if (query.type) {
    params.append('type', query.type);
  }
  if (query.direction) {
    params.append('direction', query.direction);
  }
  if (query.status) {
    params.append('status', query.status);
  }
  if (query.search) {
    params.append('search', query.search);
  }
  if (query.perPage) {
    params.append('per_page', String(query.perPage));
  }

  const suffix = params.toString();
  const path = suffix.length > 0 ? `/transactions?${suffix}` : '/transactions';

  return apiRequest<PaginatedResponse<TransactionRecord>>(path, {
    method: 'GET',
    cacheTtlMs: 10_000,
    forceRefresh: query.forceRefresh,
  });
}
