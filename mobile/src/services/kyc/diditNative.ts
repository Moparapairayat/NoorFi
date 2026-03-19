import {
  startVerification,
  VerificationStatus,
  type VerificationResult,
} from '@didit-protocol/sdk-react-native';

export type DiditLaunchOutcome = {
  state: 'approved' | 'pending' | 'declined' | 'cancelled' | 'failed';
  message: string;
  sessionId: string | null;
  providerStatus: string | null;
};

function mapFailureMessage(errorType: string, fallback: string): string {
  switch (errorType) {
    case 'sessionExpired':
      return 'Verification session expired. Please start again.';
    case 'networkError':
      return 'Network issue while opening verification. Try again.';
    case 'cameraAccessDenied':
      return 'Camera permission is required for KYC verification.';
    case 'notInitialized':
      return 'Verification SDK is not initialized yet. Reopen the app and try again.';
    case 'apiError':
      return fallback || 'Provider API error while starting verification.';
    default:
      return fallback || 'Verification failed. Please try again.';
  }
}

function mapResult(result: VerificationResult): DiditLaunchOutcome {
  if (result.type === 'completed') {
    if (result.session.status === VerificationStatus.Approved) {
      return {
        state: 'approved',
        message: 'Identity verified successfully.',
        sessionId: result.session.sessionId,
        providerStatus: 'Approved',
      };
    }

    if (result.session.status === VerificationStatus.Declined) {
      return {
        state: 'declined',
        message: 'Verification was declined. Please review your details and retry.',
        sessionId: result.session.sessionId,
        providerStatus: 'Declined',
      };
    }

    return {
      state: 'pending',
      message: 'Verification submitted and currently in review.',
      sessionId: result.session.sessionId,
      providerStatus: 'Pending',
    };
  }

  if (result.type === 'cancelled') {
    return {
      state: 'cancelled',
      message: 'Verification cancelled by user.',
      sessionId: result.session?.sessionId ?? null,
      providerStatus: result.session?.status ?? null,
    };
  }

  return {
    state: 'failed',
    message: mapFailureMessage(result.error.type, result.error.message),
    sessionId: result.session?.sessionId ?? null,
    providerStatus: result.session?.status ?? null,
  };
}

export async function launchDiditNativeVerification(
  sessionToken: string
): Promise<DiditLaunchOutcome> {
  const token = sessionToken.trim();
  if (!token) {
    return {
      state: 'failed',
      message: 'Verification session token missing. Please try again.',
      sessionId: null,
      providerStatus: null,
    };
  }

  try {
    const result = await startVerification(token, {
      languageCode: 'en',
      loggingEnabled: false,
    });
    return mapResult(result);
  } catch (error) {
    return {
      state: 'failed',
      message:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Unable to open native verification flow.',
      sessionId: null,
      providerStatus: null,
    };
  }
}

