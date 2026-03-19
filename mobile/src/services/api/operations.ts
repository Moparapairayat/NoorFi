import { apiRequest } from './client';

export type DepositMethod = 'binance_pay' | 'crypto_wallet' | 'heleket';
export type WithdrawMethod = 'crypto_wallet' | 'heleket';

export type ProviderServiceItem = {
  currency: string;
  network: string;
  network_raw?: string;
  is_available: boolean;
  is_enabled?: boolean;
  min_amount: number;
  max_amount: number;
  fee_amount: number;
  fee_percent: number;
};

export type MethodLimitByCurrency = Record<
  string,
  {
    min_amount: number;
    max_amount: number;
    fee_amount: number;
    fee_percent: number;
  }
>;

export type MethodNetworksByCurrency = Record<string, string[]>;

export type FundingMethodOption = {
  key: string;
  label: string;
  description: string;
  supported_currencies: string[];
  networks?: MethodNetworksByCurrency;
  provider_source?: 'live' | 'fallback' | string;
  provider_services?: ProviderServiceItem[];
  limits?: MethodLimitByCurrency;
  updated_at?: string;
};

export type OperationOptionsResponse = {
  methods: FundingMethodOption[];
  wallets: Array<{
    id: number;
    currency: string;
    balance: number;
    is_active: boolean;
  }>;
};

export type DepositPayload = {
  wallet_id: number;
  method: DepositMethod;
  amount: number;
  note?: string;
  network?: string;
};

export type DepositResponse = {
  message: string;
  deposit: {
    id: number;
    wallet_id: number;
    currency: string;
    method: string;
    amount: number;
    fee: number;
    net_amount: number;
    status: string;
    reference: string;
    note: string | null;
    created_at: string;
    instructions?: Record<string, unknown>;
  };
};

export type DepositSyncResponse = {
  message: string;
  deposit: {
    id: number;
    wallet_id: number;
    currency: string;
    method: string;
    amount: number;
    fee: number;
    net_amount: number;
    status: string;
    reference: string;
    note: string | null;
    credited_at: string | null;
    created_at: string;
    instructions?: Record<string, unknown>;
  };
};

export type TransferPayload = {
  wallet_id: number;
  recipient_email: string;
  amount: number;
  note?: string;
  pin: string;
};

export type TransferResponse = {
  message: string;
  transfer: {
    id: number;
    wallet_id: number;
    currency: string;
    method: string;
    recipient_label: string;
    destination: string;
    amount: number;
    fee: number;
    total_debit: number;
    net_amount: number;
    status: string;
    reference: string;
    completed_at: string | null;
    created_at: string;
    note?: string | null;
  };
};

export type WithdrawalPayload = {
  wallet_id: number;
  method: WithdrawMethod;
  network: string;
  destination_address: string;
  recipient_name?: string;
  amount: number;
  note?: string;
  pin: string;
};

export type WithdrawalResponse = {
  message: string;
  withdrawal: {
    id: number;
    wallet_id: number;
    currency: string;
    method: string;
    network: string;
    destination_address: string;
    recipient_name: string;
    amount: number;
    fee: number;
    total_debit: number;
    net_amount: number;
    status: string;
    reference: string;
    completed_at: string | null;
    created_at: string;
    note?: string | null;
    instructions?: Record<string, unknown>;
  };
};

export type QuotePayload = {
  from_currency: 'usd' | 'usdt' | 'sol';
  to_currency: 'usd' | 'usdt' | 'sol';
  amount_from: number;
};

export type QuoteResponse = {
  quote_id: string;
  from_currency: string;
  to_currency: string;
  amount_from: number;
  rate: number;
  fee: number;
  total_debit: number;
  amount_to: number;
  expires_at: string;
};

export type ExchangePayload = {
  from_wallet_id: number;
  to_currency: 'usd' | 'usdt' | 'sol';
  amount_from: number;
  quote_id?: string;
  note?: string;
  pin: string;
};

export type ExchangeResponse = {
  message: string;
  exchange: {
    id: number;
    from_wallet_id: number;
    to_wallet_id: number;
    from_currency: string;
    to_currency: string;
    amount_from: number;
    amount_to: number;
    rate: number;
    fee: number;
    total_debit: number;
    status: string;
    quote_id: string | null;
    reference: string;
    completed_at: string | null;
    created_at: string;
    note?: string | null;
  };
};

export async function createDeposit(payload: DepositPayload): Promise<DepositResponse> {
  return apiRequest<DepositResponse>('/deposits', {
    method: 'POST',
    body: payload,
  });
}

export async function syncDeposit(depositId: number): Promise<DepositSyncResponse> {
  return apiRequest<DepositSyncResponse>(`/deposits/${depositId}/sync`, {
    method: 'POST',
  });
}

export async function getDepositOptions(): Promise<OperationOptionsResponse> {
  return apiRequest<OperationOptionsResponse>('/deposits/options', {
    method: 'GET',
    cacheTtlMs: 20_000,
  });
}

export async function createTransfer(payload: TransferPayload): Promise<TransferResponse> {
  return apiRequest<TransferResponse>('/transfers', {
    method: 'POST',
    body: payload,
  });
}

export async function createWithdrawal(payload: WithdrawalPayload): Promise<WithdrawalResponse> {
  return apiRequest<WithdrawalResponse>('/withdrawals', {
    method: 'POST',
    body: payload,
  });
}

export async function getWithdrawalOptions(): Promise<OperationOptionsResponse> {
  return apiRequest<OperationOptionsResponse>('/withdrawals/options', {
    method: 'GET',
    cacheTtlMs: 20_000,
  });
}

export async function quoteExchange(payload: QuotePayload): Promise<QuoteResponse> {
  return apiRequest<QuoteResponse>('/exchanges/quote', {
    method: 'POST',
    body: payload,
  });
}

export async function createExchange(payload: ExchangePayload): Promise<ExchangeResponse> {
  return apiRequest<ExchangeResponse>('/exchanges', {
    method: 'POST',
    body: payload,
  });
}
