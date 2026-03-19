import { apiRequest, setAccessToken } from './client';
import { persistSessionToken } from '../security/biometric';

export type AuthFlow = 'login' | 'signup' | 'recovery';

export type RequestOtpPayload = {
  email: string;
  flow: AuthFlow;
  phone_number?: string;
};

export type RequestOtpResponse = {
  message: string;
  email: string;
  flow: AuthFlow;
  phone_number?: string | null;
  expires_in_seconds: number;
  otp_code?: string;
};

export type PasswordResetOtpResponse = {
  message: string;
  email: string;
  expires_in_seconds: number;
  otp_code?: string;
};

export type VerifyOtpPayload = {
  email: string;
  flow: AuthFlow;
  code: string;
  full_name?: string;
  password?: string;
  password_confirmation?: string;
  phone_number?: string;
};

export type VerifyOtpResponse = {
  message: string;
  flow: AuthFlow;
  token_type: 'Bearer';
  access_token: string;
  requires_pin_setup: boolean;
  user: {
    id: number;
    name: string;
    email: string;
    phone_number?: string | null;
    kyc_status: string;
    account_status: string;
  };
};

export type MeResponse = {
  user: {
    id: number;
    name: string;
    email: string;
    phone_number?: string | null;
    kyc_status: string;
    account_status: string;
    last_login_at?: string | null;
  };
  wallets: Array<{
    id: number;
    currency: string;
    balance: number;
    locked_balance: number;
    is_active: boolean;
  }>;
};

export type UpdateProfilePayload = {
  full_name: string;
};

export type UpdateProfileResponse = {
  message: string;
  user: {
    id: number;
    name: string;
    email: string;
    phone_number?: string | null;
    kyc_status: string;
    account_status: string;
    last_login_at?: string | null;
  };
};

export async function requestOtp(payload: RequestOtpPayload): Promise<RequestOtpResponse> {
  return apiRequest<RequestOtpResponse>('/auth/otp/request', {
    method: 'POST',
    body: payload,
    authenticated: false,
  });
}

export async function verifyOtp(payload: VerifyOtpPayload): Promise<VerifyOtpResponse> {
  const response = await apiRequest<VerifyOtpResponse>('/auth/otp/verify', {
    method: 'POST',
    body: payload,
    authenticated: false,
  });

  setAccessToken(response.access_token);
  try {
    await persistSessionToken(response.access_token);
  } catch {
    // Do not block login when secure token persistence fails.
  }

  return response;
}

export type PasswordLoginPayload = {
  email: string;
  password: string;
};

export type ResetPasswordPayload = {
  email: string;
  code: string;
  password: string;
  password_confirmation: string;
};

export async function loginWithPassword(
  payload: PasswordLoginPayload
): Promise<VerifyOtpResponse> {
  const response = await apiRequest<VerifyOtpResponse>('/auth/login', {
    method: 'POST',
    body: payload,
    authenticated: false,
  });

  setAccessToken(response.access_token);
  try {
    await persistSessionToken(response.access_token);
  } catch {
    // Do not block login when secure token persistence fails.
  }

  return response;
}

export async function requestPasswordResetOtp(email: string): Promise<PasswordResetOtpResponse> {
  return apiRequest<PasswordResetOtpResponse>('/auth/password/otp/request', {
    method: 'POST',
    body: { email },
    authenticated: false,
  });
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/password/reset', {
    method: 'POST',
    body: payload,
    authenticated: false,
  });
}

export async function setPin(pin: string, currentPin?: string): Promise<void> {
  const normalizedCurrentPin = (currentPin ?? '').trim();
  const body: { pin: string; current_pin?: string } = { pin };
  if (normalizedCurrentPin.length > 0) {
    body.current_pin = normalizedCurrentPin;
  }

  await apiRequest<{ message: string }>('/auth/set-pin', {
    method: 'POST',
    body,
  });
}

export async function getMe(
  options: { forceRefresh?: boolean } = {}
): Promise<MeResponse> {
  return apiRequest<MeResponse>('/auth/me', {
    method: 'GET',
    cacheTtlMs: 15_000,
    forceRefresh: options.forceRefresh,
  });
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<UpdateProfileResponse> {
  return apiRequest<UpdateProfileResponse>('/auth/profile', {
    method: 'PUT',
    body: payload,
  });
}

export async function logout(): Promise<void> {
  await apiRequest<{ message: string }>('/auth/logout', {
    method: 'POST',
  });
  setAccessToken(null);
  try {
    await persistSessionToken(null);
  } catch {
    // Ignore local storage cleanup errors on logout.
  }
}
