import { apiRequest } from './client';

export type KycProfilePayload = {
  full_name: string;
  date_of_birth: string;
  nationality: string;
  occupation: string;
  document_type: 'national_id' | 'passport' | 'driving_license';
  document_number: string;
  issuing_country: string;
  document_expiry_date: string;
  address_line: string;
  city: string;
  postal_code: string;
  country: string;
  address_proof_type: 'utility_bill' | 'bank_statement' | 'rental_agreement';
  phone_number: string;
  id_type?: string;
  id_image_url?: string;
  selfie_image_url?: string;
  address_proof_url?: string;
  selfie_confirmed: boolean;
};

export type KycSubmitResponse = {
  message: string;
  submission_id: string;
  submitted_at: string | null;
  review_eta: string;
  tier_after_approval: string;
  kyc_status: string;
  profile: Record<string, unknown>;
};

export type DiditSessionResponse = {
  message: string;
  session_id: string | null;
  session_token: string | null;
  verification_url: string | null;
  provider_status: string | null;
  decision: string | null;
  kyc_status: string | null;
  profile: Record<string, unknown>;
};

export type KycProfileRecord = {
  id: number;
  full_name?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  occupation?: string | null;
  document_type?: KycProfilePayload['document_type'] | null;
  document_number?: string | null;
  issuing_country?: string | null;
  document_expiry_date?: string | null;
  address_line?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  address_proof_type?: KycProfilePayload['address_proof_type'] | null;
  phone_number?: string | null;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  didit?: {
    session_id?: string | null;
    session_url?: string | null;
    provider_status?: string | null;
    decision?: string | null;
    last_webhook_at?: string | null;
  };
  [key: string]: unknown;
};

export type KycProfileResponse = {
  kyc_status: string;
  didit?: {
    session_id?: string | null;
    session_url?: string | null;
    provider_status?: string | null;
    decision?: string | null;
  };
  profile: KycProfileRecord | null;
};

export async function submitKycProfile(
  payload: KycProfilePayload
): Promise<KycSubmitResponse> {
  return apiRequest<KycSubmitResponse>('/kyc/profile', {
    method: 'POST',
    body: payload,
  });
}

export async function startDiditSession(forceNew = true): Promise<DiditSessionResponse> {
  return apiRequest<DiditSessionResponse>('/kyc/didit/session', {
    method: 'POST',
    body: { force_new: forceNew },
  });
}

export async function getDiditSessionStatus(refresh = false): Promise<DiditSessionResponse> {
  return apiRequest<DiditSessionResponse>(`/kyc/didit/session/status?refresh=${refresh ? '1' : '0'}`);
}

export async function getKycProfile(
  options: { forceRefresh?: boolean } = {}
): Promise<KycProfileResponse> {
  return apiRequest<KycProfileResponse>('/kyc/profile', {
    method: 'GET',
    cacheTtlMs: 15_000,
    forceRefresh: options.forceRefresh,
  });
}
