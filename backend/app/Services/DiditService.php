<?php

namespace App\Services;

use App\Models\KycProfile;
use App\Models\User;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class DiditService
{
    private string $apiKey;

    private string $workflowId;

    private string $baseUrl;

    private ?string $callbackUrl;

    private string $callbackMethod;

    private string $language;

    private bool $sendNotificationEmails;

    private string $webhookSecret;

    private int $timeoutSeconds;

    public function __construct()
    {
        $this->apiKey = trim((string) config('services.didit.api_key', ''));
        $this->workflowId = trim((string) config('services.didit.workflow_id', ''));
        $this->baseUrl = rtrim(trim((string) config('services.didit.base_url', 'https://verification.didit.me')), '/');
        $configuredCallbackUrl = trim((string) config('services.didit.callback_url', ''));
        $configuredCallbackMethod = trim((string) config('services.didit.callback_method', 'initiator')) ?: 'initiator';
        $normalizedCallbackUrl = strtolower($configuredCallbackUrl);

        $isHttpCallback = preg_match('/^https?:\/\//i', $configuredCallbackUrl) === 1;
        $isEphemeralTunnel = str_contains($normalizedCallbackUrl, '.trycloudflare.com');
        $isDisabled = $configuredCallbackUrl === '' || ! $isHttpCallback || $isEphemeralTunnel;

        $this->callbackUrl = $isDisabled ? null : $configuredCallbackUrl;
        $this->callbackMethod = $configuredCallbackMethod;
        $this->language = trim((string) config('services.didit.language', 'en')) ?: 'en';
        $this->sendNotificationEmails = (bool) config('services.didit.send_notification_emails', false);
        $this->webhookSecret = trim((string) config('services.didit.webhook_secret', ''));
        $this->timeoutSeconds = max((int) config('services.didit.timeout_seconds', 25), 5);
    }

    /**
     * @return array<string, mixed>
     */
    public function createKycSession(User $user, ?KycProfile $profile = null): array
    {
        $this->assertConfigured();

        $callback = $this->buildCallbackPayload();

        $contactDetails = [
            'email' => strtolower(trim((string) $user->email)),
            'send_notification_emails' => $this->sendNotificationEmails,
            'email_lang' => $this->language,
        ];

        $phone = trim((string) ($profile?->phone_number ?? ''));
        if ($phone !== '') {
            $contactDetails['phone'] = $phone;
        }

        $payload = [
            'workflow_id' => $this->workflowId,
            'vendor_data' => $this->buildVendorData($user),
            'contact_details' => $contactDetails,
        ];

        if ($callback !== null) {
            $payload['callback'] = (string) $callback['url'];
            $payload['callback_method'] = (string) $callback['callback_method'];
        }

        $response = $this->http()->post($this->url('/v3/session/'), $payload);

        return $this->decodeResponse($response, 'create session');
    }

    /**
     * @return array<string, mixed>
     */
    public function retrieveSession(string $sessionId): array
    {
        $this->assertConfigured();

        $sessionId = trim($sessionId);
        if ($sessionId === '') {
            throw new RuntimeException('Didit session ID is required.');
        }

        $response = $this->http()->get($this->url("/v3/session/{$sessionId}/"));
        if ($response->status() === 404) {
            // Some Didit workspaces expose only the decision endpoint for session lookup.
            $fallback = $this->http()->get($this->url("/v3/session/{$sessionId}/decision/"));
            return $this->decodeResponse($fallback, 'retrieve session');
        }

        return $this->decodeResponse($response, 'retrieve session');
    }

    /**
     * @return array<string, mixed>
     */
    public function retrieveSessionDecision(string $sessionId): array
    {
        $this->assertConfigured();

        $sessionId = trim($sessionId);
        if ($sessionId === '') {
            throw new RuntimeException('Didit session ID is required.');
        }

        $response = $this->http()->get($this->url("/v3/session/{$sessionId}/decision/"));

        return $this->decodeResponse($response, 'retrieve session decision');
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function verifyWebhookSignature(
        array $payload,
        ?string $timestampHeader,
        ?string $signatureV2Header,
        ?string $signatureSimpleHeader
    ): bool {
        $secret = $this->webhookSecret;
        if ($secret === '') {
            return false;
        }

        $timestamp = trim((string) $timestampHeader);
        if (! ctype_digit($timestamp)) {
            return false;
        }

        $time = (int) $timestamp;
        if (abs(time() - $time) > 300) {
            return false;
        }

        $signatureV2 = $this->normalizeSignature($signatureV2Header);
        if ($signatureV2 !== null) {
            $expected = hash_hmac('sha256', $this->canonicalizePayload($payload), $secret);
            if (hash_equals($expected, strtolower($signatureV2))) {
                return true;
            }
        }

        $signatureSimple = $this->normalizeSignature($signatureSimpleHeader);
        if ($signatureSimple !== null) {
            $sessionId = (string) (
                data_get($payload, 'session_id')
                ?: data_get($payload, 'session.id')
                ?: data_get($payload, 'session.session_id')
                ?: ''
            );
            $status = (string) (
                data_get($payload, 'status')
                ?: data_get($payload, 'session.status')
                ?: ''
            );
            $webhookType = (string) (
                data_get($payload, 'webhook_type')
                ?: data_get($payload, 'event')
                ?: data_get($payload, 'type')
                ?: ''
            );

            $canonical = "{$timestamp}:{$sessionId}:{$status}:{$webhookType}";
            $expected = hash_hmac('sha256', $canonical, $secret);

            if (hash_equals($expected, strtolower($signatureSimple))) {
                return true;
            }
        }

        return false;
    }

    private function assertConfigured(): void
    {
        if ($this->apiKey === '') {
            throw new RuntimeException('Didit API key is not configured.');
        }

        if ($this->workflowId === '') {
            throw new RuntimeException('Didit workflow ID is not configured.');
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function buildCallbackPayload(): ?array
    {
        if ($this->callbackUrl === null) {
            return null;
        }

        return [
            'url' => $this->callbackUrl,
            'callback_method' => $this->callbackMethod,
        ];
    }

    private function http(): PendingRequest
    {
        return Http::asJson()
            ->acceptJson()
            ->timeout($this->timeoutSeconds)
            ->withToken($this->apiKey)
            ->withHeaders([
                'x-api-key' => $this->apiKey,
            ]);
    }

    private function url(string $path): string
    {
        return $this->baseUrl . '/' . ltrim($path, '/');
    }

    private function buildVendorData(User $user): string
    {
        $suffix = dechex(time());

        try {
            $suffix .= substr(bin2hex(random_bytes(3)), 0, 6);
        } catch (\Throwable) {
            $suffix .= (string) mt_rand(100000, 999999);
        }

        return 'noorfi_user_' . $user->id . '_' . $suffix;
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeResponse(Response $response, string $operation): array
    {
        $payload = $response->json();

        if (! $response->successful()) {
            $message = $this->extractMessage(is_array($payload) ? $payload : null);
            throw new RuntimeException(
                "Didit {$operation} failed with HTTP {$response->status()}: "
                . ($message !== '' ? $message : 'Unexpected provider response.')
            );
        }

        if (! is_array($payload)) {
            throw new RuntimeException("Didit {$operation} returned invalid payload.");
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>|null  $payload
     */
    private function extractMessage(?array $payload): string
    {
        if ($payload === null) {
            return '';
        }

        $message = $payload['message'] ?? null;
        if (is_string($message) && trim($message) !== '') {
            return trim($message);
        }

        $detail = $payload['detail'] ?? null;
        if (is_string($detail) && trim($detail) !== '') {
            return trim($detail);
        }

        $error = $payload['error'] ?? null;
        if (is_string($error) && trim($error) !== '') {
            return trim($error);
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

        $flattened = [];
        array_walk_recursive($payload, function ($value) use (&$flattened): void {
            if (is_scalar($value)) {
                $flattened[] = (string) $value;
            }
        });

        return trim(implode(' | ', array_filter($flattened)));
    }

    private function normalizeSignature(?string $signature): ?string
    {
        if (! is_string($signature)) {
            return null;
        }

        $value = trim($signature);
        if ($value === '') {
            return null;
        }

        if (str_contains($value, '=')) {
            $value = (string) str($value)->afterLast('=');
        }

        return strtolower(trim($value));
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function canonicalizePayload(array $payload): string
    {
        $normalized = $this->canonicalizeValue($payload);

        return (string) json_encode(
            $normalized,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );
    }

    /**
     * @return mixed
     */
    private function canonicalizeValue(mixed $value): mixed
    {
        if (is_array($value)) {
            if (array_is_list($value)) {
                return array_map(fn ($item) => $this->canonicalizeValue($item), $value);
            }

            $normalized = [];
            ksort($value);
            foreach ($value as $key => $item) {
                $normalized[(string) $key] = $this->canonicalizeValue($item);
            }

            return $normalized;
        }

        if (is_float($value) && floor($value) === $value) {
            return (int) $value;
        }

        return $value;
    }
}
