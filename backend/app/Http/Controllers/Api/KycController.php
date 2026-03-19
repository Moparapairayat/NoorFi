<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KycProfile;
use App\Models\User;
use App\Services\DiditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class KycController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $profile = $user->kycProfile;

        return response()->json([
            'kyc_status' => $user->kyc_status,
            'didit' => $this->transformDiditState($user),
            'profile' => $profile ? $this->transformProfile($profile) : null,
        ]);
    }

    public function upsert(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $existingProfile = $user->kycProfile;

        $alreadySubmitted = ($existingProfile?->submitted_at !== null)
            || in_array((string) ($existingProfile?->status ?? ''), [
                'submitted',
                'in_review',
                'approved',
                'rejected',
            ], true)
            || in_array((string) $user->kyc_status, [
                'submitted',
                'approved',
                'rejected',
            ], true);

        if ($alreadySubmitted) {
            throw ValidationException::withMessages([
                'kyc' => 'KYC already submitted once. Contact support if you need a reset.',
            ]);
        }

        $data = $request->validate([
            'full_name' => ['required', 'string', 'min:3', 'max:120'],
            'date_of_birth' => ['required', 'date', 'before:today'],
            'nationality' => ['required', 'string', 'min:2', 'max:60'],
            'occupation' => ['required', 'string', 'min:2', 'max:100'],
            'document_type' => ['required', 'in:national_id,passport,driving_license'],
            'document_number' => ['required', 'string', 'min:6', 'max:80'],
            'issuing_country' => ['required', 'string', 'min:2', 'max:80'],
            'document_expiry_date' => ['required', 'date', 'after:today'],
            'address_line' => ['required', 'string', 'min:8', 'max:255'],
            'city' => ['required', 'string', 'min:2', 'max:80'],
            'postal_code' => ['required', 'string', 'min:3', 'max:30'],
            'country' => ['required', 'string', 'min:2', 'max:80'],
            'address_proof_type' => ['required', 'in:utility_bill,bank_statement,rental_agreement'],
            'phone_number' => ['required', 'string', 'min:8', 'max:24'],
            'id_type' => ['nullable', 'string', 'max:40'],
            'id_image_url' => ['nullable', 'url', 'max:2048'],
            'selfie_image_url' => ['nullable', 'url', 'max:2048'],
            'address_proof_url' => ['nullable', 'url', 'max:2048'],
            'selfie_confirmed' => ['required', 'boolean'],
        ]);

        $isSubmitted = (bool) $data['selfie_confirmed'];
        $profileStatus = $isSubmitted ? 'submitted' : 'draft';

        $profile = KycProfile::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'full_name' => trim((string) $data['full_name']),
                'date_of_birth' => $data['date_of_birth'],
                'nationality' => trim((string) $data['nationality']),
                'occupation' => trim((string) $data['occupation']),
                'document_type' => $data['document_type'],
                'document_number' => trim((string) $data['document_number']),
                'issuing_country' => trim((string) $data['issuing_country']),
                'document_expiry_date' => $data['document_expiry_date'],
                'address_line' => trim((string) $data['address_line']),
                'city' => trim((string) $data['city']),
                'postal_code' => trim((string) $data['postal_code']),
                'country' => trim((string) $data['country']),
                'address_proof_type' => $data['address_proof_type'],
                'phone_number' => trim((string) $data['phone_number']),
                'id_type' => $data['id_type'] ?? null,
                'id_image_url' => $data['id_image_url'] ?? null,
                'selfie_image_url' => $data['selfie_image_url'] ?? null,
                'address_proof_url' => $data['address_proof_url'] ?? null,
                'status' => $profileStatus,
                'submitted_at' => $isSubmitted ? now() : null,
                'approved_at' => null,
                'rejected_at' => null,
                'review_note' => null,
            ]
        );

        $fullName = trim((string) $data['full_name']);
        $displayName = $fullName !== '' ? $fullName : $user->name;
        $kycStatus = $isSubmitted ? 'submitted' : 'pending';

        $user->forceFill([
            'full_name' => $displayName,
            'name' => $displayName,
            'kyc_status' => $kycStatus,
        ])->save();

        return response()->json([
            'message' => $isSubmitted
                ? 'KYC profile submitted successfully.'
                : 'KYC profile saved as draft.',
            'submission_id' => 'KYC-' . str_pad((string) $profile->id, 6, '0', STR_PAD_LEFT),
            'submitted_at' => optional($profile->submitted_at)->toIso8601String(),
            'review_eta' => '24-48 hours',
            'tier_after_approval' => 'Tier 3',
            'kyc_status' => $user->kyc_status,
            'didit' => $this->transformDiditState($user),
            'profile' => $this->transformProfile($profile),
        ]);
    }

    public function startDiditSession(
        Request $request,
        DiditService $diditService
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();
        $profile = $user->kycProfile;
        $forceNewSession = $request->has('force_new')
            ? $request->boolean('force_new')
            : true;

        if ($user->kyc_status === 'approved') {
            return response()->json([
                'message' => 'KYC already approved.',
                'session_id' => $user->didit_session_id,
                'session_token' => null,
                'verification_url' => $user->didit_session_url,
                'provider_status' => $user->didit_vendor_status,
                'decision' => $user->didit_decision,
                'kyc_status' => $user->kyc_status,
                'didit' => $this->transformDiditState($user),
                'profile' => $profile ? $this->transformProfile($profile) : null,
            ]);
        }

        $profileStatus = strtolower(trim((string) ($profile?->status ?? '')));
        $kycStatus = strtolower(trim((string) $user->kyc_status));
        $sessionIdForReviewCheck = trim((string) ($user->didit_session_id ?: ($profile?->didit_session_id ?? '')));
        $currentDiditStatus = $this->normalizeDiditStatus((string) (
            $user->didit_decision
            ?: $user->didit_vendor_status
            ?: ($profile?->didit_decision ?? '')
            ?: ($profile?->didit_vendor_status ?? '')
            ?: ''
        ));
        $isSubmittedReviewState = in_array($profileStatus, ['submitted', 'in_review'], true)
            || $kycStatus === 'submitted';

        if (
            $isSubmittedReviewState
            && $sessionIdForReviewCheck !== ''
            && ! $this->isDiditTerminalStatus($currentDiditStatus)
        ) {
            throw ValidationException::withMessages([
                'kyc' => 'KYC is already in review. You cannot verify again until decision is completed.',
            ]);
        }

        if (! $forceNewSession) {
            $existingState = $this->normalizeDiditStatus((string) (
                $user->didit_decision ?: $user->didit_vendor_status
            ));
            if (
                $user->didit_session_id
                && $user->didit_session_url
                && ! in_array($existingState, [
                    'approved',
                    'declined',
                    'rejected',
                    'expired',
                    'abandoned',
                    'failed',
                    'cancelled',
                    'canceled',
                    'not started',
                ], true)
            ) {
                return response()->json([
                    'message' => 'Reusing active verification session.',
                    'session_id' => $user->didit_session_id,
                    'session_token' => null,
                    'verification_url' => $user->didit_session_url,
                    'provider_status' => $user->didit_vendor_status,
                    'decision' => $user->didit_decision,
                    'kyc_status' => $user->kyc_status,
                    'didit' => $this->transformDiditState($user),
                    'profile' => $profile ? $this->transformProfile($profile) : null,
                ]);
            }
        }

        try {
            $session = $diditService->createKycSession($user, $profile);
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages([
                'kyc' => $exception->getMessage(),
            ]);
        }

        $sessionId = trim((string) (
            data_get($session, 'session_id')
            ?: data_get($session, 'id')
            ?: data_get($session, 'session.id')
            ?: ''
        ));
        $sessionUrl = trim((string) (
            data_get($session, 'url')
            ?: data_get($session, 'session_url')
            ?: data_get($session, 'verification_url')
            ?: data_get($session, 'hosted_url')
            ?: data_get($session, 'redirect_url')
            ?: data_get($session, 'session.url')
            ?: ''
        ));
        $sessionToken = trim((string) (
            data_get($session, 'session_token')
            ?: data_get($session, 'token')
            ?: data_get($session, 'session.token')
            ?: ''
        ));
        $providerStatus = trim((string) (
            data_get($session, 'status')
            ?: data_get($session, 'session.status')
            ?: 'in_review'
        ));
        if ($sessionToken === '' && $sessionUrl !== '') {
            $sessionToken = $this->extractDiditTokenFromUrl($sessionUrl) ?? '';
        }

        if ($sessionToken === '' && $sessionId !== '') {
            try {
                $sessionLookup = $diditService->retrieveSession($sessionId);
                $lookupToken = trim((string) (
                    data_get($sessionLookup, 'session_token')
                    ?: data_get($sessionLookup, 'token')
                    ?: data_get($sessionLookup, 'session.token')
                    ?: ''
                ));

                if ($lookupToken === '' && $sessionUrl !== '') {
                    $lookupToken = $this->extractDiditTokenFromUrl($sessionUrl) ?? '';
                }

                if ($lookupToken !== '') {
                    $sessionToken = $lookupToken;
                }

                if ($sessionUrl === '') {
                    $sessionUrl = trim((string) (
                        data_get($sessionLookup, 'url')
                        ?: data_get($sessionLookup, 'session_url')
                        ?: data_get($sessionLookup, 'verification_url')
                        ?: data_get($sessionLookup, 'hosted_url')
                        ?: data_get($sessionLookup, 'redirect_url')
                        ?: data_get($sessionLookup, 'session.url')
                        ?: ''
                    ));
                }

                $lookupStatus = trim((string) (
                    data_get($sessionLookup, 'status')
                    ?: data_get($sessionLookup, 'session.status')
                    ?: ''
                ));
                if ($lookupStatus !== '') {
                    $providerStatus = $lookupStatus;
                }
            } catch (RuntimeException $exception) {
                Log::warning('Failed to retrieve Didit session token fallback.', [
                    'user_id' => $user->id,
                    'session_id' => $sessionId,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        if ($sessionUrl === '') {
            if ($sessionToken !== '') {
                $sessionUrl = 'https://verify.didit.me/session/' . $sessionToken;
            }
        }

        if ($sessionId === '' || ($sessionUrl === '' && $sessionToken === '')) {
            throw ValidationException::withMessages([
                'kyc' => 'Didit response did not include session details.',
            ]);
        }

        DB::transaction(function () use ($user, $profile, $sessionId, $sessionUrl, $providerStatus, $session): void {
            $userDiditPayload = $user->didit_payload ?? [];
            if (! is_array($userDiditPayload)) {
                $userDiditPayload = [];
            }
            $userDiditPayload[] = [
                'source' => 'session_create',
                'payload' => $session,
                'updated_at' => now()->toIso8601String(),
            ];

            $user->forceFill([
                'didit_session_id' => $sessionId,
                'didit_session_url' => $sessionUrl,
                'didit_vendor_status' => $providerStatus,
                'didit_decision' => null,
                'didit_reference_id' => (string) (
                    data_get($session, 'reference_id')
                    ?: data_get($session, 'reference')
                    ?: ''
                ) ?: null,
                'didit_payload' => $userDiditPayload,
                'kyc_status' => $user->kyc_status === 'approved' ? 'approved' : 'submitted',
            ])->save();

            if ($profile instanceof KycProfile) {
                $profileDiditPayload = $profile->didit_payload ?? [];
                if (! is_array($profileDiditPayload)) {
                    $profileDiditPayload = [];
                }
                $profileDiditPayload[] = [
                    'source' => 'session_create',
                    'payload' => $session,
                    'updated_at' => now()->toIso8601String(),
                ];

                $profile->forceFill([
                    'status' => $profile->status === 'approved' ? 'approved' : 'in_review',
                    'submitted_at' => $profile->submitted_at ?? now(),
                    'approved_at' => null,
                    'rejected_at' => null,
                    'review_note' => null,
                    'didit_session_id' => $sessionId,
                    'didit_session_url' => $sessionUrl,
                    'didit_vendor_status' => $providerStatus,
                    'didit_decision' => null,
                    'didit_reference_id' => (string) (
                        data_get($session, 'reference_id')
                        ?: data_get($session, 'reference')
                        ?: ''
                    ) ?: null,
                    'didit_payload' => $profileDiditPayload,
                ])->save();
            }
        });

        $freshUser = $user->fresh();
        $freshProfile = $profile?->fresh();

        return response()->json([
            'message' => 'Verification session created successfully.',
            'session_id' => $freshUser?->didit_session_id,
            'session_token' => $sessionToken !== '' ? $sessionToken : null,
            'verification_url' => $freshUser?->didit_session_url,
            'provider_status' => $freshUser?->didit_vendor_status,
            'decision' => $freshUser?->didit_decision,
            'kyc_status' => $freshUser?->kyc_status,
            'didit' => $freshUser ? $this->transformDiditState($freshUser) : null,
            'profile' => $freshProfile ? $this->transformProfile($freshProfile) : null,
        ]);
    }

    public function diditSessionStatus(
        Request $request,
        DiditService $diditService
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();
        $profile = $user->kycProfile;

        $sessionId = trim((string) ($user->didit_session_id ?: ($profile?->didit_session_id ?? '')));
        if ($sessionId === '') {
            return response()->json([
                'message' => 'Didit session has not been started yet.',
                'session_id' => null,
                'session_token' => null,
                'verification_url' => null,
                'provider_status' => null,
                'decision' => null,
                'kyc_status' => $user->kyc_status,
                'didit' => $this->transformDiditState($user),
                'profile' => $profile ? $this->transformProfile($profile) : null,
            ]);
        }

        if ($request->boolean('refresh')) {
            $sessionPayload = null;
            $decisionPayload = null;

            try {
                $sessionPayload = $diditService->retrieveSession($sessionId);
            } catch (RuntimeException $exception) {
                Log::warning('Failed to refresh Didit session payload.', [
                    'session_id' => $sessionId,
                    'user_id' => $user->id,
                    'error' => $exception->getMessage(),
                ]);
            }

            try {
                $decisionPayload = $diditService->retrieveSessionDecision($sessionId);
            } catch (RuntimeException $exception) {
                Log::warning('Failed to refresh Didit decision payload.', [
                    'session_id' => $sessionId,
                    'user_id' => $user->id,
                    'error' => $exception->getMessage(),
                ]);
            }

            if (is_array($sessionPayload) || is_array($decisionPayload)) {
                $this->applyDiditState(
                    user: $user,
                    profile: $profile instanceof KycProfile ? $profile : null,
                    sessionPayload: is_array($sessionPayload) ? $sessionPayload : null,
                    decisionPayload: is_array($decisionPayload) ? $decisionPayload : null,
                    isWebhook: false
                );
            }
        }

        $freshUser = $user->fresh();
        $freshProfile = $profile?->fresh();

        return response()->json([
            'message' => 'Didit session status loaded.',
            'session_id' => $freshUser?->didit_session_id,
            'session_token' => null,
            'verification_url' => $freshUser?->didit_session_url,
            'provider_status' => $freshUser?->didit_vendor_status,
            'decision' => $freshUser?->didit_decision,
            'kyc_status' => $freshUser?->kyc_status,
            'didit' => $freshUser ? $this->transformDiditState($freshUser) : null,
            'profile' => $freshProfile ? $this->transformProfile($freshProfile) : null,
        ]);
    }

    public function diditWebhook(
        Request $request,
        DiditService $diditService
    ): JsonResponse {
        $payload = $request->json()->all();
        if (! is_array($payload)) {
            return response()->json([
                'message' => 'Invalid webhook payload.',
            ], 422);
        }

        $isVerified = $diditService->verifyWebhookSignature(
            payload: $payload,
            timestampHeader: $request->header('X-Timestamp'),
            signatureV2Header: $request->header('X-Signature-V2'),
            signatureSimpleHeader: $request->header('X-Signature-Simple'),
        );

        if (! $isVerified) {
            return response()->json([
                'message' => 'Invalid webhook signature.',
            ], 401);
        }

        $sessionId = trim((string) (
            data_get($payload, 'session_id')
            ?: data_get($payload, 'session.id')
            ?: data_get($payload, 'session.session_id')
            ?: ''
        ));

        $user = $sessionId !== ''
            ? User::query()->where('didit_session_id', $sessionId)->first()
            : null;

        if (! $user) {
            $vendorData = (string) (
                data_get($payload, 'vendor_data')
                ?: data_get($payload, 'session.vendor_data')
                ?: ''
            );

            if (preg_match('/noorfi_user_(\d+)/', $vendorData, $matches) === 1) {
                $user = User::query()->find((int) $matches[1]);
            }
        }

        if (! $user instanceof User) {
            return response()->json([
                'message' => 'Webhook accepted. No matching user found.',
            ], 202);
        }

        $profile = $user->kycProfile;

        $this->applyDiditState(
            user: $user,
            profile: $profile instanceof KycProfile ? $profile : null,
            sessionPayload: $payload,
            decisionPayload: null,
            isWebhook: true
        );

        return response()->json([
            'message' => 'Webhook processed successfully.',
        ]);
    }

    public function diditCallback(): JsonResponse
    {
        return response()->json([
            'message' => 'Verification flow completed. You can return to NoorFi app.',
        ]);
    }

    private function transformProfile(KycProfile $profile): array
    {
        return [
            'id' => $profile->id,
            'full_name' => $profile->full_name,
            'date_of_birth' => optional($profile->date_of_birth)?->toDateString(),
            'nationality' => $profile->nationality,
            'occupation' => $profile->occupation,
            'document_type' => $profile->document_type,
            'document_number' => $profile->document_number,
            'issuing_country' => $profile->issuing_country,
            'document_expiry_date' => optional($profile->document_expiry_date)?->toDateString(),
            'address_line' => $profile->address_line,
            'city' => $profile->city,
            'postal_code' => $profile->postal_code,
            'country' => $profile->country,
            'address_proof_type' => $profile->address_proof_type,
            'phone_number' => $profile->phone_number,
            'id_type' => $profile->id_type,
            'id_image_url' => $profile->id_image_url,
            'selfie_image_url' => $profile->selfie_image_url,
            'address_proof_url' => $profile->address_proof_url,
            'status' => $profile->status,
            'submitted_at' => optional($profile->submitted_at)?->toIso8601String(),
            'approved_at' => optional($profile->approved_at)?->toIso8601String(),
            'rejected_at' => optional($profile->rejected_at)?->toIso8601String(),
            'review_note' => $profile->review_note,
            'didit' => [
                'session_id' => $profile->didit_session_id,
                'reference_id' => $profile->didit_reference_id,
                'session_url' => $profile->didit_session_url,
                'provider_status' => $profile->didit_vendor_status,
                'decision' => $profile->didit_decision,
                'last_webhook_at' => optional($profile->didit_last_webhook_at)?->toIso8601String(),
            ],
        ];
    }

    private function transformDiditState(User $user): array
    {
        return [
            'session_id' => $user->didit_session_id,
            'reference_id' => $user->didit_reference_id,
            'session_url' => $user->didit_session_url,
            'provider_status' => $user->didit_vendor_status,
            'decision' => $user->didit_decision,
            'last_webhook_at' => optional($user->didit_last_webhook_at)?->toIso8601String(),
        ];
    }

    private function extractDiditTokenFromUrl(string $url): ?string
    {
        $url = trim($url);
        if ($url === '') {
            return null;
        }

        $query = parse_url($url, PHP_URL_QUERY);
        if (is_string($query) && $query !== '') {
            $queryParams = [];
            parse_str($query, $queryParams);
            if (is_array($queryParams)) {
                $queryToken = trim((string) (
                    $queryParams['session_token']
                    ?? $queryParams['token']
                    ?? ''
                ));
                if ($queryToken !== '') {
                    return $queryToken;
                }
            }
        }

        $path = (string) parse_url($url, PHP_URL_PATH);
        if ($path !== '' && preg_match('/\/session\/([^\/?#]+)/i', $path, $matches) === 1) {
            $pathToken = trim((string) urldecode($matches[1]));
            if ($pathToken !== '') {
                return $pathToken;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>|null  $sessionPayload
     * @param  array<string, mixed>|null  $decisionPayload
     */
    private function applyDiditState(
        User $user,
        ?KycProfile $profile,
        ?array $sessionPayload,
        ?array $decisionPayload,
        bool $isWebhook
    ): void {
        $rawVendorStatus = trim((string) (
            data_get($decisionPayload, 'status')
            ?: data_get($sessionPayload, 'status')
            ?: data_get($sessionPayload, 'session.status')
            ?: data_get($sessionPayload, 'result.status')
            ?: ''
        ));
        $rawDecision = trim((string) (
            data_get($decisionPayload, 'decision')
            ?: data_get($decisionPayload, 'result')
            ?: data_get($decisionPayload, 'status')
            ?: data_get($sessionPayload, 'decision')
            ?: data_get($sessionPayload, 'result.decision')
            ?: ''
        ));
        $sessionId = trim((string) (
            data_get($sessionPayload, 'session_id')
            ?: data_get($sessionPayload, 'session.id')
            ?: data_get($sessionPayload, 'session.session_id')
            ?: ''
        ));

        $normalizedDecision = $this->normalizeDiditStatus($rawDecision !== '' ? $rawDecision : $rawVendorStatus);
        $nextUserStatus = $user->kyc_status;

        if ($normalizedDecision === 'approved') {
            $nextUserStatus = 'approved';
        } elseif (in_array($normalizedDecision, ['declined', 'rejected', 'expired', 'abandoned'], true)) {
            $nextUserStatus = 'rejected';
        } elseif ($user->kyc_status !== 'approved') {
            $nextUserStatus = 'submitted';
        }

        $payloadBundle = array_filter([
            'session' => $sessionPayload,
            'decision' => $decisionPayload,
            'updated_at' => now()->toIso8601String(),
            'source' => $isWebhook ? 'webhook' : 'sync',
        ], fn ($value) => $value !== null);

        DB::transaction(function () use (
            $user,
            $profile,
            $sessionId,
            $rawVendorStatus,
            $rawDecision,
            $nextUserStatus,
            $normalizedDecision,
            $payloadBundle,
            $isWebhook
        ): void {
            $userDiditPayload = $user->didit_payload ?? [];
            if (! is_array($userDiditPayload)) {
                $userDiditPayload = [];
            }
            $userDiditPayload[] = $payloadBundle;

            $userUpdates = [
                'kyc_status' => $nextUserStatus,
                'didit_session_id' => $sessionId !== '' ? $sessionId : $user->didit_session_id,
                'didit_vendor_status' => $rawVendorStatus !== '' ? $rawVendorStatus : $user->didit_vendor_status,
                'didit_decision' => $rawDecision !== '' ? $rawDecision : $user->didit_decision,
                'didit_last_webhook_at' => $isWebhook ? now() : $user->didit_last_webhook_at,
                'didit_payload' => $userDiditPayload,
            ];

            if ($normalizedDecision === 'approved' && $profile instanceof KycProfile) {
                $verifiedFullName = trim((string) $profile->full_name);
                $verifiedPhone = trim((string) $profile->phone_number);

                if ($verifiedFullName !== '') {
                    $userUpdates['full_name'] = $verifiedFullName;
                    $userUpdates['name'] = $verifiedFullName;
                }

                if ($verifiedPhone !== '') {
                    $userUpdates['phone_number'] = $verifiedPhone;
                }
            }

            $user->forceFill($userUpdates)->save();

            if (! $profile instanceof KycProfile) {
                return;
            }

            $nextProfileStatus = $profile->status;
            $approvedAt = $profile->approved_at;
            $rejectedAt = $profile->rejected_at;
            $reviewNote = $profile->review_note;

            if ($normalizedDecision === 'approved') {
                $nextProfileStatus = 'approved';
                $approvedAt = $approvedAt ?? now();
                $rejectedAt = null;
                $reviewNote = null;
            } elseif (in_array($normalizedDecision, ['declined', 'rejected', 'expired', 'abandoned'], true)) {
                $nextProfileStatus = 'rejected';
                $rejectedAt = now();
                $approvedAt = null;
                $reviewNote = $rawDecision !== '' ? "Didit decision: {$rawDecision}" : 'Didit declined this verification.';
            } elseif ($profile->status !== 'approved') {
                $nextProfileStatus = 'in_review';
            }

            $profileDiditPayload = $profile->didit_payload ?? [];
            if (! is_array($profileDiditPayload)) {
                $profileDiditPayload = [];
            }
            $profileDiditPayload[] = $payloadBundle;

            $profile->forceFill([
                'status' => $nextProfileStatus,
                'submitted_at' => $profile->submitted_at ?? now(),
                'approved_at' => $approvedAt,
                'rejected_at' => $rejectedAt,
                'review_note' => $reviewNote,
                'didit_session_id' => $sessionId !== '' ? $sessionId : $profile->didit_session_id,
                'didit_vendor_status' => $rawVendorStatus !== '' ? $rawVendorStatus : $profile->didit_vendor_status,
                'didit_decision' => $rawDecision !== '' ? $rawDecision : $profile->didit_decision,
                'didit_last_webhook_at' => $isWebhook ? now() : $profile->didit_last_webhook_at,
                'didit_payload' => $profileDiditPayload,
            ])->save();
        });
    }

    private function normalizeDiditStatus(string $status): string
    {
        $normalized = strtolower(trim($status));
        $normalized = str_replace(['-', '_'], ' ', $normalized);
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;

        return $normalized;
    }

    private function isDiditTerminalStatus(string $normalizedStatus): bool
    {
        $status = $this->normalizeDiditStatus($normalizedStatus);

        return in_array($status, [
            'approved',
            'declined',
            'rejected',
            'expired',
            'abandoned',
            'failed',
            'cancelled',
            'canceled',
        ], true);
    }
}
