import { apiRequest } from './client';

export type CardRecord = {
  id: number;
  type: 'virtual' | 'physical';
  template_name: string;
  holder_name: string;
  brand: string;
  theme: string;
  status: string;
  last4: string | null;
  masked_number: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  currency: string;
  issued_at: string | null;
  frozen_at?: string | null;
  provider: string;
  provider_card_id: string | null;
  meta?: Record<string, unknown>;
};

export type RevealedCardDetails = {
  card_number: string;
  cvv: string;
  expiry: string | null;
  holder_name: string;
};

export type ProviderCardTransaction = {
  id: string;
  reference: string;
  status: string;
  type: string;
  amount: number;
  currency: string;
  direction: 'credit' | 'debit';
  merchant: string;
  description: string;
  occurred_at: string | null;
  raw?: Record<string, unknown>;
};

export type ApplyVirtualCardPayload = {
  card_type: 'virtual';
  card_name: string;
  holder_name: string;
  theme: string;
  funding_wallet_id?: number;
  issue_fee?: number;
  prefund_amount?: number;
};

type CardListResponse = {
  cards: CardRecord[];
};

type CardResponse = {
  card: CardRecord;
};

type ApplyVirtualCardResponse = {
  message: string;
  card: CardRecord;
};

type RevealCardResponse = {
  card: CardRecord;
  sensitive: RevealedCardDetails;
};

type ProviderCardTransactionsResponse = {
  transactions: ProviderCardTransaction[];
};

type CardControlResponse = {
  message: string;
  card: CardRecord;
  provider_response?: Record<string, unknown>;
};
export type CardFundPayload = {
  amount: number;
  funding_wallet_id?: number;
};

export type CardWithdrawPayload = {
  amount: number;
  destination_wallet_id?: number;
};

export async function getCards(): Promise<CardRecord[]> {
  const response = await apiRequest<CardListResponse>('/cards');
  return response.cards;
}

export async function getCard(cardId: number): Promise<CardRecord> {
  const response = await apiRequest<CardResponse>(`/cards/${cardId}`);
  return response.card;
}

export async function applyVirtualCard(
  payload: ApplyVirtualCardPayload
): Promise<ApplyVirtualCardResponse> {
  return apiRequest<ApplyVirtualCardResponse>('/cards/apply', {
    method: 'POST',
    body: payload,
  });
}

export async function revealCardDetails(cardId: number, pin: string): Promise<RevealCardResponse> {
  return apiRequest<RevealCardResponse>(`/cards/${cardId}/reveal`, {
    method: 'POST',
    body: { pin },
  });
}

export async function getCardProviderTransactions(
  cardId: number,
  limit = 20
): Promise<ProviderCardTransaction[]> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 20;
  const response = await apiRequest<ProviderCardTransactionsResponse>(
    `/cards/${cardId}/provider-transactions?limit=${safeLimit}`
  );

  return response.transactions;
}

export async function freezeCard(cardId: number): Promise<CardControlResponse> {
  return apiRequest<CardControlResponse>(`/cards/${cardId}/freeze`, {
    method: 'POST',
  });
}

export async function unfreezeCard(cardId: number): Promise<CardControlResponse> {
  return apiRequest<CardControlResponse>(`/cards/${cardId}/unfreeze`, {
    method: 'POST',
  });
}


export async function addCardFund(
  cardId: number,
  payload: CardFundPayload
): Promise<CardControlResponse> {
  return apiRequest<CardControlResponse>(`/cards/${cardId}/add-fund`, {
    method: 'POST',
    body: payload,
  });
}

export async function withdrawFromCard(
  cardId: number,
  payload: CardWithdrawPayload
): Promise<CardControlResponse> {
  return apiRequest<CardControlResponse>(`/cards/${cardId}/withdraw`, {
    method: 'POST',
    body: payload,
  });
}
export async function upgradeCardLimit(cardId: number): Promise<CardControlResponse> {
  return apiRequest<CardControlResponse>(`/cards/${cardId}/upgrade-limit`, {
    method: 'POST',
  });
}

