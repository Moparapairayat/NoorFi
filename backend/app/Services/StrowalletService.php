<?php

namespace App\Services;

use App\Models\KycProfile;
use App\Models\User;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class StrowalletService
{
    private string $publicKey;

    private string $secretKey;

    private ?string $mode;

    private string $cardType;

    private string $baseUrl;

    private int $timeoutSeconds;

    private string $createCustomerEndpoint;

    private string $createCustomerMethod;

    private ?string $createCustomerEndpointFallback;

    private string $createCustomerEndpointFallbackMethod;

    private string $getCustomerEndpoint;

    private string $createCardEndpoint;

    private string $cardDetailsEndpoint;

    private string $cardTransactionsEndpoint;

    private string $freezeUnfreezeEndpoint;

    private string $upgradeCardLimitEndpoint;

    private string $fundCardEndpoint;

    private string $withdrawFromCardEndpoint;

    public function __construct()
    {
        $this->publicKey = trim((string) config('services.strowallet.public_key', ''));
        $this->secretKey = trim((string) config('services.strowallet.secret_key', ''));
        $this->mode = trim((string) config('services.strowallet.mode', '')) ?: null;
        $this->cardType = trim((string) config('services.strowallet.card_type', 'mastercard')) ?: 'mastercard';
        $this->baseUrl = rtrim(
            trim((string) config('services.strowallet.base_url', 'https://strowallet.com/api/bitvcard')),
            '/'
        );
        $this->timeoutSeconds = max((int) config('services.strowallet.timeout_seconds', 25), 5);
        $this->createCustomerEndpoint = trim((string) config('services.strowallet.create_customer_endpoint', ''))
            ?: "{$this->baseUrl}/create-user";
        $this->createCustomerMethod = strtoupper(trim((string) config('services.strowallet.create_customer_method', 'POST')));
        $this->createCustomerEndpointFallback = trim((string) config('services.strowallet.create_customer_endpoint_fallback', '')) ?: null;
        $this->createCustomerEndpointFallbackMethod = strtoupper(trim((string) config('services.strowallet.create_customer_endpoint_fallback_method', 'GET')));
        $this->getCustomerEndpoint = trim((string) config('services.strowallet.get_customer_endpoint', ''))
            ?: "{$this->baseUrl}/getcardholder";
        $this->createCardEndpoint = trim((string) config('services.strowallet.create_card_endpoint', ''))
            ?: "{$this->baseUrl}/create-card";
        $this->cardDetailsEndpoint = trim((string) config('services.strowallet.card_details_endpoint', ''))
            ?: "{$this->baseUrl}/fetch-card-detail";
        $this->cardTransactionsEndpoint = trim((string) config('services.strowallet.card_transactions_endpoint', ''))
            ?: "{$this->baseUrl}/card-transactions";
        $this->freezeUnfreezeEndpoint = trim((string) config('services.strowallet.freeze_unfreeze_endpoint', ''))
            ?: "{$this->baseUrl}/action/status";
        $this->upgradeCardLimitEndpoint = trim((string) config('services.strowallet.upgrade_card_limit_endpoint', ''))
            ?: "{$this->baseUrl}/upgradecardlimit";
        $this->fundCardEndpoint = trim((string) config('services.strowallet.fund_card_endpoint', ''))
            ?: "{$this->baseUrl}/fund-card";
        $this->withdrawFromCardEndpoint = trim((string) config('services.strowallet.withdraw_from_card_endpoint', ''))
            ?: "{$this->baseUrl}/card_withdraw";
    }

    /**
     * @return array{
     *     customer_id: string,
     *     card: array<string,mixed>,
     *     card_details: array<string,mixed>|null
     * }
     */
    public function createVirtualCard(User $user, string $nameOnCard, float $prefundAmount): array
    {
        $this->assertConfigured();

        $customerId = '';
        try {
            $customerId = $this->ensureCustomer($user);
        } catch (RuntimeException $exception) {
            if (! $this->isRecoverableCustomerSetupError($exception->getMessage())) {
                throw $exception;
            }

            Log::warning('Strowallet customer lookup failed but card creation will continue with customer email.', [
                'user_id' => $user->id,
                'email' => $user->email,
                'error' => $exception->getMessage(),
            ]);
        }

        $payload = [
            'name_on_card' => trim($nameOnCard),
            'card_type' => $this->cardType,
            'public_key' => $this->publicKey,
            'amount' => $this->formatAmount($prefundAmount),
            'customerEmail' => strtolower(trim((string) $user->email)),
        ];

        if ($this->mode !== null) {
            $payload['mode'] = $this->mode;
        }

        $cardResponse = $this->postJson(
            endpoint: $this->createCardEndpoint,
            payload: $payload,
            operation: 'create virtual card',
        );

        $providerCardId = (string) (
            data_get($cardResponse, 'response.card_id')
            ?: data_get($cardResponse, 'response.cardId')
            ?: ''
        );

        $details = null;

        if ($providerCardId !== '') {
            try {
                $details = $this->fetchCardDetails($providerCardId);
            } catch (RuntimeException $exception) {
                Log::warning('Strowallet card details fetch failed right after card creation.', [
                    'user_id' => $user->id,
                    'provider_card_id' => $providerCardId,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        return [
            'customer_id' => $customerId,
            'card' => $cardResponse,
            'card_details' => $details,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function fetchCardDetails(string $providerCardId): array
    {
        $this->assertConfigured();

        $payload = [
            'card_id' => trim($providerCardId),
            'public_key' => $this->publicKey,
        ];

        if ($this->mode !== null) {
            $payload['mode'] = $this->mode;
        }

        return $this->postJson(
            endpoint: $this->cardDetailsEndpoint,
            payload: $payload,
            operation: 'fetch card details',
        );
    }

    /**
     * @return array<string,mixed>
     */
    public function fetchCardTransactions(string $providerCardId): array
    {
        $this->assertConfigured();

        if ($this->cardTransactionsEndpoint === '') {
            throw new RuntimeException('Strowallet card transactions endpoint is not configured.');
        }

        $payload = [
            'card_id' => trim($providerCardId),
            'public_key' => $this->publicKey,
        ];

        if ($this->mode !== null) {
            $payload['mode'] = $this->mode;
        }

        return $this->postJson(
            endpoint: $this->cardTransactionsEndpoint,
            payload: $payload,
            operation: 'fetch card transactions',
        );
    }

    /**
     * @return array<string,mixed>
     */
    public function setCardFreezeStatus(string $providerCardId, bool $freeze): array
    {
        $this->assertConfigured();

        if ($this->freezeUnfreezeEndpoint === '') {
            throw new RuntimeException('Strowallet freeze/unfreeze endpoint is not configured.');
        }

        $query = [
            'action' => $freeze ? 'freeze' : 'unfreeze',
            'card_id' => trim($providerCardId),
            'public_key' => $this->publicKey,
        ];

        return $this->requestWithQuery(
            endpoint: $this->freezeUnfreezeEndpoint,
            query: $query,
            payload: [],
            operation: $freeze ? 'freeze card' : 'unfreeze card',
            method: 'POST',
        );
    }

    /**
     * @return array<string,mixed>
     */
    public function upgradeCardLimit(
        string $customerId,
        string $cardUserId,
        string $firstName,
        string $lastName,
        string $dateOfBirth,
        string $line1
    ): array {
        $this->assertConfigured();

        if ($this->upgradeCardLimitEndpoint === '') {
            throw new RuntimeException('Strowallet upgrade card limit endpoint is not configured.');
        }

        $query = [
            'public_key' => $this->publicKey,
            'customerId' => trim($customerId),
            'cardUserId' => trim($cardUserId),
            'firstName' => trim($firstName),
            'lastName' => trim($lastName),
            'dateOfBirth' => trim($dateOfBirth),
            'line1' => trim($line1),
        ];

        return $this->requestWithQuery(
            endpoint: $this->upgradeCardLimitEndpoint,
            query: $query,
            payload: [],
            operation: 'upgrade card limit',
            method: 'POST',
        );
    }
    /**
     * @return array<string,mixed>
     */
    public function fundCard(string $providerCardId, float $amount): array
    {
        $this->assertConfigured();

        if ($this->fundCardEndpoint === '') {
            throw new RuntimeException('Strowallet fund card endpoint is not configured.');
        }

        $query = [
            'card_id' => trim($providerCardId),
            'amount' => $this->formatAmount($amount),
            'public_key' => $this->publicKey,
        ];

        if ($this->mode !== null) {
            $query['mode'] = $this->mode;
        }

        return $this->requestWithQuery(
            endpoint: $this->fundCardEndpoint,
            query: $query,
            payload: [],
            operation: 'fund card',
            method: 'POST',
        );
    }

    /**
     * @return array<string,mixed>
     */
    public function withdrawFromCard(string $providerCardId, float $amount): array
    {
        $this->assertConfigured();

        if ($this->withdrawFromCardEndpoint === '') {
            throw new RuntimeException('Strowallet withdraw from card endpoint is not configured.');
        }

        $query = [
            'card_id' => trim($providerCardId),
            'amount' => $this->formatAmount($amount),
            'public_key' => $this->publicKey,
        ];

        if ($this->mode !== null) {
            $query['mode'] = $this->mode;
        }

        return $this->requestWithQuery(
            endpoint: $this->withdrawFromCardEndpoint,
            query: $query,
            payload: [],
            operation: 'withdraw from card',
            method: 'POST',
        );
    }

    private function ensureCustomer(User $user): string
    {
        $existingCustomerId = trim((string) $user->strowallet_customer_id);

        if ($existingCustomerId !== '') {
            return $existingCustomerId;
        }

        $customerLookup = $this->findCustomerByEmail((string) $user->email);
        $lookupCustomerId = (string) (
            data_get($customerLookup, 'data.customerId')
            ?: data_get($customerLookup, 'response.customerId')
            ?: ''
        );

        if ($lookupCustomerId !== '') {
            $user->forceFill([
                'strowallet_customer_id' => $lookupCustomerId,
            ])->save();

            return $lookupCustomerId;
        }

        try {
            $created = $this->createCustomer($user);
        } catch (RuntimeException $exception) {
            if (! $this->isDuplicateCustomerMessage($exception->getMessage())) {
                throw $exception;
            }

            $retryLookup = $this->findCustomerByEmail((string) $user->email);
            $retryLookupCustomerId = (string) (
                data_get($retryLookup, 'data.customerId')
                ?: data_get($retryLookup, 'response.customerId')
                ?: ''
            );

            if ($retryLookupCustomerId === '') {
                throw $exception;
            }

            $user->forceFill([
                'strowallet_customer_id' => $retryLookupCustomerId,
            ])->save();

            return $retryLookupCustomerId;
        }

        $customerId = (string) (
            data_get($created, 'response.customerId')
            ?: data_get($created, 'data.customerId')
            ?: ''
        );

        if ($customerId === '') {
            throw new RuntimeException('Strowallet customer ID was not returned by provider.');
        }

        $user->forceFill([
            'strowallet_customer_id' => $customerId,
        ])->save();

        return $customerId;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function findCustomerByEmail(string $email): ?array
    {
        $normalizedEmail = strtolower(trim($email));
        $query = [
            'public_key' => $this->publicKey,
            'customerEmail' => $normalizedEmail,
        ];

        $response = $this->getJson(
            endpoint: $this->getCustomerEndpoint,
            query: $query,
            operation: 'get customer by email',
            allowNotFound: true,
        );

        if ($response !== null && $this->hasCustomerId($response)) {
            return $response;
        }

        $legacyQuery = [
            'public_key' => $this->publicKey,
            'email' => $normalizedEmail,
        ];

        try {
            return $this->getJson(
                endpoint: $this->getCustomerEndpoint,
                query: $legacyQuery,
                operation: 'get customer by email (legacy)',
                allowNotFound: true,
            );
        } catch (RuntimeException $exception) {
            if (str_contains(strtolower($exception->getMessage()), 'customerid or customeremail is required')) {
                return null;
            }

            throw $exception;
        }
    }

    /**
     * @return array<string,mixed>
     */
    private function createCustomer(User $user): array
    {
        $profile = $user->kycProfile;

        if (! $profile instanceof KycProfile) {
            throw new RuntimeException('KYC profile is missing. Submit KYC before applying card.');
        }

        if (! in_array($profile->status, ['submitted', 'approved'], true)) {
            throw new RuntimeException('KYC profile is not submitted yet. Please complete KYC.');
        }

        [$firstName, $lastName] = $this->resolveNamePartsFromProfile($profile, $user);
        $dob = optional($profile->date_of_birth)?->format('d/m/Y');

        if (! $dob) {
            throw new RuntimeException('KYC date of birth is missing.');
        }

        $idImage = trim((string) $profile->id_image_url);
        $userPhoto = trim((string) $profile->selfie_image_url);

        if ($idImage === '' || $userPhoto === '') {
            throw new RuntimeException(
                'KYC image URLs are missing. Please provide document and selfie image URLs in KYC profile.'
            );
        }

        $phoneNumber = $this->normalizePhoneNumber($profile->phone_number);

        if ($phoneNumber === '') {
            throw new RuntimeException('KYC phone number is invalid.');
        }

        $query = [
            'public_key' => $this->publicKey,
            'houseNumber' => $this->resolveHouseNumber($profile->address_line),
            'firstName' => $firstName,
            'lastName' => $lastName,
            'idNumber' => trim((string) $profile->document_number),
            'customerEmail' => strtolower(trim((string) $user->email)),
            'phoneNumber' => $phoneNumber,
            'dateOfBirth' => $dob,
            'idImage' => $idImage,
            'userPhoto' => $userPhoto,
            'line1' => trim((string) $profile->address_line),
            'state' => trim((string) $profile->city),
            'zipCode' => trim((string) $profile->postal_code),
            'city' => trim((string) $profile->city),
            'country' => trim((string) $profile->country),
            'idType' => $this->mapIdType($profile),
        ];

        try {
            return $this->requestWithQuery(
                endpoint: $this->createCustomerEndpoint,
                query: $query,
                payload: [],
                operation: 'create customer',
                method: $this->createCustomerMethod,
            );
        } catch (RuntimeException $exception) {
            if ($this->createCustomerEndpointFallback === null || ! $this->shouldTryFallback($exception)) {
                throw $exception;
            }

            return $this->requestWithQuery(
                endpoint: $this->createCustomerEndpointFallback,
                query: $query,
                payload: [],
                operation: 'create customer (fallback)',
                method: $this->createCustomerEndpointFallbackMethod,
            );
        }
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function resolveNamePartsFromProfile(KycProfile $profile, User $user): array
    {
        $fullName = trim((string) ($profile->full_name ?: $user->full_name ?: $user->name ?: 'NoorFi User'));
        $parts = preg_split('/\s+/', $fullName) ?: [];
        $firstName = trim((string) ($parts[0] ?? 'NoorFi'));
        $lastName = trim((string) implode(' ', array_slice($parts, 1)));

        if ($lastName === '') {
            $lastName = 'User';
        }

        return [$firstName, $lastName];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string,mixed>
     */
    private function postJson(string $endpoint, array $payload, string $operation): array
    {
        $response = $this->http()->post($this->normalizeEndpoint($endpoint), $payload);

        return $this->decodeResponse($response, $operation) ?? [];
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string,mixed>|null
     */
    private function getJson(string $endpoint, array $query, string $operation, bool $allowNotFound = false): ?array
    {
        $response = $this->http()->get($this->normalizeEndpoint($endpoint), $query);

        return $this->decodeResponse($response, $operation, $allowNotFound);
    }

    /**
     * @param  array<string, mixed>  $query
     * @param  array<string, mixed>  $payload
     * @return array<string,mixed>
     */
    private function requestWithQuery(
        string $endpoint,
        array $query,
        array $payload,
        string $operation,
        string $method
    ): array {
        $normalizedMethod = strtoupper(trim($method));
        $url = $this->appendQuery($this->normalizeEndpoint($endpoint), $query);

        $response = match ($normalizedMethod) {
            'GET' => $this->http()->get($url),
            default => $this->http()->post($url, $payload),
        };

        return $this->decodeResponse($response, $operation) ?? [];
    }

    /**
     * @return array<string,mixed>|null
     */
    private function decodeResponse(Response $response, string $operation, bool $allowNotFound = false): ?array
    {
        $payload = $response->json();
        $message = is_array($payload) ? $this->extractMessage($payload) : '';

        if (! $response->successful()) {
            if ($allowNotFound && $this->isNotFoundMessage($message)) {
                return null;
            }

            throw new RuntimeException(
                "Strowallet {$operation} failed with HTTP {$response->status()}: "
                . ($message !== '' ? $message : 'Unexpected response.')
            );
        }

        if (! is_array($payload)) {
            throw new RuntimeException("Strowallet {$operation} returned an invalid response body.");
        }

        if (array_key_exists('success', $payload) && $payload['success'] === false) {
            if ($allowNotFound && $this->isNotFoundMessage($message)) {
                return null;
            }

            throw new RuntimeException(
                "Strowallet {$operation} failed: "
                . ($message !== '' ? $message : 'Provider returned unsuccessful response.')
            );
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function extractMessage(array $payload): string
    {
        $raw = $payload['message'] ?? null;

        if (is_string($raw)) {
            return trim($raw);
        }

        if (is_array($raw)) {
            $flattened = [];
            array_walk_recursive($raw, function ($value) use (&$flattened): void {
                if (is_scalar($value)) {
                    $flattened[] = (string) $value;
                }
            });

            return trim(implode(' | ', array_filter($flattened)));
        }

        $errors = $payload['errors'] ?? null;
        if (is_array($errors)) {
            $flattened = [];
            array_walk_recursive($errors, function ($value) use (&$flattened): void {
                if (is_scalar($value)) {
                    $flattened[] = (string) $value;
                }
            });

            return trim(implode(' | ', array_filter($flattened)));
        }

        return '';
    }

    private function isNotFoundMessage(string $message): bool
    {
        return str_contains(strtolower($message), 'not found');
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function hasCustomerId(array $payload): bool
    {
        $customerId = (string) (
            data_get($payload, 'data.customerId')
            ?: data_get($payload, 'response.customerId')
            ?: ''
        );

        return $customerId !== '';
    }

    private function shouldTryFallback(RuntimeException $exception): bool
    {
        $message = strtolower($exception->getMessage());

        return str_contains($message, 'not found')
            || str_contains($message, 'http 404')
            || str_contains($message, 'http 405')
            || str_contains($message, 'method is not supported');
    }

    private function isDuplicateCustomerMessage(string $message): bool
    {
        $normalized = strtolower($message);

        return str_contains($normalized, 'already been taken')
            || str_contains($normalized, 'already exists')
            || str_contains($normalized, 'duplicate');
    }

    private function isRecoverableCustomerSetupError(string $message): bool
    {
        return $this->isDuplicateCustomerMessage($message);
    }

    private function resolveHouseNumber(string $addressLine): string
    {
        if (preg_match('/\d+/', $addressLine, $matches) === 1) {
            return $matches[0];
        }

        return '1';
    }

    private function normalizePhoneNumber(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if ($digits === '') {
            return '';
        }

        if (strlen($digits) < 10) {
            return '';
        }

        return strlen($digits) > 15 ? substr($digits, 0, 15) : $digits;
    }

    private function mapIdType(KycProfile $profile): string
    {
        $provided = strtoupper(trim((string) ($profile->id_type ?? '')));
        if ($provided !== '') {
            return $provided;
        }

        return match ($profile->document_type) {
            'passport' => 'PASSPORT',
            'driving_license' => 'DRIVING_LICENSE',
            default => 'NATIONAL_ID',
        };
    }

    private function assertConfigured(): void
    {
        if ($this->publicKey === '' || $this->secretKey === '') {
            throw new RuntimeException('Strowallet API keys are not configured in environment.');
        }

        if (
            $this->createCustomerEndpoint === ''
            || $this->createCardEndpoint === ''
            || $this->cardDetailsEndpoint === ''
        ) {
            throw new RuntimeException('Strowallet endpoint configuration is incomplete.');
        }
    }

    private function http(): PendingRequest
    {
        return Http::asJson()
            ->acceptJson()
            ->timeout($this->timeoutSeconds)
            ->withHeaders([
                'Authorization' => 'Bearer ' . $this->secretKey,
                'x-api-key' => $this->secretKey,
                'X-API-KEY' => $this->secretKey,
            ]);
    }

    /**
     * @param  array<string, mixed>  $query
     */
    private function appendQuery(string $endpoint, array $query): string
    {
        if ($query === []) {
            return $endpoint;
        }

        $separator = str_contains($endpoint, '?') ? '&' : '?';

        return $endpoint . $separator . http_build_query($query);
    }

    private function normalizeEndpoint(string $endpoint): string
    {
        return rtrim(trim($endpoint), '/');
    }

    private function formatAmount(float $amount): string
    {
        return number_format(max($amount, 0), 2, '.', '');
    }
}


