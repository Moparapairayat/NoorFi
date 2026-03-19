<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class HeleketService
{
    private string $merchantId;

    private string $paymentApiKey;

    private string $payoutApiKey;

    private string $baseUrl;

    private ?string $callbackUrl;

    private ?string $payoutCallbackUrl;

    private ?string $successUrl;

    private ?string $returnUrl;

    private int $timeoutSeconds;

    public function __construct()
    {
        $this->merchantId = trim((string) config('services.heleket.merchant_id', ''));
        $this->paymentApiKey = trim((string) config('services.heleket.payment_api_key', ''));
        $this->payoutApiKey = trim((string) config('services.heleket.payout_api_key', ''));
        $this->baseUrl = rtrim(trim((string) config('services.heleket.base_url', 'https://api.heleket.com')), '/');
        $this->callbackUrl = $this->normalizeUrl((string) config('services.heleket.callback_url', ''));
        $this->payoutCallbackUrl = $this->normalizeUrl((string) config('services.heleket.payout_callback_url', ''))
            ?? $this->callbackUrl;
        $this->successUrl = $this->normalizeUrl((string) config('services.heleket.success_url', ''));
        $this->returnUrl = $this->normalizeUrl((string) config('services.heleket.return_url', ''));
        $this->timeoutSeconds = max((int) config('services.heleket.timeout_seconds', 25), 5);
    }

    /**
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function createInvoice(
        float $amount,
        string $currency,
        string $orderId,
        ?string $network = null,
        array $options = []
    ): array {
        $this->assertPaymentConfigured();

        $payload = array_filter([
            'amount' => $this->formatAmount($amount),
            'currency' => strtoupper(trim($currency)),
            'order_id' => trim($orderId),
            'network' => $network !== null && trim($network) !== ''
                ? strtolower(trim($network))
                : null,
            'to_currency' => isset($options['to_currency']) && trim((string) $options['to_currency']) !== ''
                ? strtoupper(trim((string) $options['to_currency']))
                : null,
            'url_callback' => $this->callbackUrl,
            'url_success' => $this->successUrl,
            'url_return' => $this->returnUrl,
            'is_payment_multiple' => (bool) ($options['is_payment_multiple'] ?? false),
            'lifetime' => max((int) ($options['lifetime'] ?? 3600), 300),
            'additional_data' => isset($options['additional_data']) && trim((string) $options['additional_data']) !== ''
                ? trim((string) $options['additional_data'])
                : null,
        ], static fn ($value) => $value !== null && $value !== '');

        $response = $this->request('payment', $payload, 'create payment', $this->paymentApiKey);
        $result = data_get($response, 'result');

        if (! is_array($result)) {
            throw new RuntimeException('Heleket create payment failed: missing result payload.');
        }

        return $result;
    }

    /**
     * @return array<string, mixed>
     */
    public function paymentInfoByOrderId(string $orderId): array
    {
        $this->assertPaymentConfigured();

        $response = $this->request('payment/info', [
            'order_id' => trim($orderId),
        ], 'fetch payment info', $this->paymentApiKey);
        $result = data_get($response, 'result');

        if (! is_array($result)) {
            throw new RuntimeException('Heleket payment info failed: missing result payload.');
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function verifyWebhookSignature(array $payload): bool
    {
        $sign = trim((string) ($payload['sign'] ?? ''));
        if ($sign === '' || $this->paymentApiKey === '') {
            return false;
        }

        $signSource = $payload;
        unset($signSource['sign']);

        $encoded = json_encode($signSource, JSON_UNESCAPED_UNICODE);
        if ($encoded === false) {
            return false;
        }

        $expected = md5(base64_encode($encoded) . $this->paymentApiKey);

        return hash_equals(strtolower($expected), strtolower($sign));
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function paymentServices(): array
    {
        $this->assertPaymentConfigured();

        $response = $this->request('payment/services', (object) [], 'fetch payment services', $this->paymentApiKey);
        $result = data_get($response, 'result');

        if (! is_array($result)) {
            throw new RuntimeException('Heleket payment services failed: missing result payload.');
        }

        return array_values(array_filter($result, static fn ($item): bool => is_array($item)));
    }

    /**
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function createStaticWallet(
        string $currency,
        string $network,
        string $orderId,
        array $options = []
    ): array {
        $this->assertPaymentConfigured();

        $payload = array_filter([
            'currency' => strtoupper(trim($currency)),
            'network' => strtolower(trim($network)),
            'order_id' => trim($orderId),
            'url_callback' => isset($options['url_callback']) && trim((string) $options['url_callback']) !== ''
                ? trim((string) $options['url_callback'])
                : $this->callbackUrl,
        ], static fn ($value) => $value !== null && $value !== '');

        $response = $this->request('wallet', $payload, 'create static wallet', $this->paymentApiKey);
        $result = data_get($response, 'result');

        if (! is_array($result)) {
            throw new RuntimeException('Heleket create static wallet failed: missing result payload.');
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function createPayout(
        float $amount,
        string $currency,
        string $orderId,
        string $address,
        ?string $network = null,
        array $options = []
    ): array {
        $this->assertPayoutConfigured();

        $payload = array_filter([
            'amount' => $this->formatAmount($amount),
            'currency' => strtoupper(trim($currency)),
            'order_id' => trim($orderId),
            'address' => trim($address),
            'network' => $network !== null && trim($network) !== ''
                ? strtoupper(trim($network))
                : null,
            'url_callback' => $options['url_callback'] ?? $this->payoutCallbackUrl,
            'is_subtract' => (bool) ($options['is_subtract'] ?? true),
            'to_currency' => isset($options['to_currency']) && trim((string) $options['to_currency']) !== ''
                ? strtoupper(trim((string) $options['to_currency']))
                : null,
            'from_currency' => isset($options['from_currency']) && trim((string) $options['from_currency']) !== ''
                ? strtoupper(trim((string) $options['from_currency']))
                : null,
            'priority' => isset($options['priority']) && trim((string) $options['priority']) !== ''
                ? strtolower(trim((string) $options['priority']))
                : null,
            'course_source' => isset($options['course_source']) && trim((string) $options['course_source']) !== ''
                ? trim((string) $options['course_source'])
                : null,
            'memo' => isset($options['memo']) && trim((string) $options['memo']) !== ''
                ? trim((string) $options['memo'])
                : null,
        ], static fn ($value) => $value !== null && $value !== '');

        $response = $this->request('payout', $payload, 'create payout', $this->payoutApiKey);
        $result = data_get($response, 'result');

        if (! is_array($result)) {
            throw new RuntimeException('Heleket create payout failed: missing result payload.');
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function calculatePayout(
        float $amount,
        string $currency,
        string $address,
        ?string $network = null,
        array $options = []
    ): array {
        $this->assertPayoutConfigured();

        $payload = array_filter([
            'amount' => $this->formatAmount($amount),
            'currency' => strtoupper(trim($currency)),
            'address' => trim($address),
            'network' => $network !== null && trim($network) !== ''
                ? strtoupper(trim($network))
                : null,
            'is_subtract' => (bool) ($options['is_subtract'] ?? true),
            'to_currency' => isset($options['to_currency']) && trim((string) $options['to_currency']) !== ''
                ? strtoupper(trim((string) $options['to_currency']))
                : null,
            'priority' => isset($options['priority']) && trim((string) $options['priority']) !== ''
                ? strtolower(trim((string) $options['priority']))
                : null,
            'course_source' => isset($options['course_source']) && trim((string) $options['course_source']) !== ''
                ? trim((string) $options['course_source'])
                : null,
        ], static fn ($value) => $value !== null && $value !== '');

        $response = $this->request('payout/calc', $payload, 'calculate payout', $this->payoutApiKey);
        $result = data_get($response, 'result');

        if (! is_array($result)) {
            throw new RuntimeException('Heleket payout calc failed: missing result payload.');
        }

        return $result;
    }

    /**
     * @return array<string, mixed>
     */
    public function payoutInfoByOrderId(string $orderId): array
    {
        $this->assertPayoutConfigured();

        $response = $this->request('payout/info', [
            'order_id' => trim($orderId),
        ], 'fetch payout info', $this->payoutApiKey);
        $result = data_get($response, 'result');

        if (! is_array($result)) {
            throw new RuntimeException('Heleket payout info failed: missing result payload.');
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function verifyPayoutWebhookSignature(array $payload): bool
    {
        $sign = trim((string) ($payload['sign'] ?? ''));
        if ($sign === '') {
            return false;
        }

        if ($this->payoutApiKey !== '' && $this->verifySignatureWithKey($payload, $this->payoutApiKey)) {
            return true;
        }

        if ($this->paymentApiKey !== '' && $this->verifySignatureWithKey($payload, $this->paymentApiKey)) {
            return true;
        }

        return false;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function payoutServices(): array
    {
        $this->assertPayoutConfigured();

        $response = $this->request('payout/services', (object) [], 'fetch payout services', $this->payoutApiKey);
        $result = data_get($response, 'result');

        if (! is_array($result)) {
            throw new RuntimeException('Heleket payout services failed: missing result payload.');
        }

        return array_values(array_filter($result, static fn ($item): bool => is_array($item)));
    }

    private function assertMerchantConfigured(): void
    {
        if ($this->merchantId === '') {
            throw new RuntimeException('Heleket merchant ID is not configured.');
        }
    }

    private function assertPaymentConfigured(): void
    {
        $this->assertMerchantConfigured();

        if ($this->paymentApiKey === '') {
            throw new RuntimeException('Heleket payment API key is not configured.');
        }
    }

    private function assertPayoutConfigured(): void
    {
        $this->assertMerchantConfigured();

        if ($this->payoutApiKey === '') {
            throw new RuntimeException('Heleket payout API key is not configured.');
        }

        if ($this->payoutCallbackUrl === null) {
            throw new RuntimeException('Heleket payout callback URL is not configured.');
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function request(string $methodName, array|object $payload, string $operation, string $apiKey): array
    {
        $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE);
        if ($jsonPayload === false) {
            throw new RuntimeException("Unable to encode Heleket payload for {$operation}.");
        }

        $sign = md5(base64_encode($jsonPayload) . $apiKey);

        $response = Http::acceptJson()
            ->withHeaders([
                'merchant' => $this->merchantId,
                'sign' => $sign,
                'Content-Type' => 'application/json',
            ])
            ->withBody($jsonPayload, 'application/json')
            ->timeout($this->timeoutSeconds)
            ->post($this->baseUrl . '/v1/' . ltrim($methodName, '/'));

        return $this->decodeResponse($response, $operation);
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeResponse(Response $response, string $operation): array
    {
        $payload = $response->json();

        if (! is_array($payload)) {
            throw new RuntimeException("Heleket {$operation} failed with invalid response format.");
        }

        if (! $response->successful()) {
            $message = $this->extractErrorMessage($payload);
            throw new RuntimeException(
                "Heleket {$operation} failed with HTTP {$response->status()}: "
                . ($message !== '' ? $message : 'Unexpected provider response.')
            );
        }

        $state = (int) ($payload['state'] ?? -1);
        if ($state !== 0) {
            $message = $this->extractErrorMessage($payload);
            throw new RuntimeException(
                "Heleket {$operation} rejected: " . ($message !== '' ? $message : 'Unknown provider error.')
            );
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function extractErrorMessage(array $payload): string
    {
        $errors = $payload['errors'] ?? null;
        if (is_array($errors)) {
            foreach ($errors as $error) {
                if (is_string($error) && trim($error) !== '') {
                    return trim($error);
                }

                if (is_array($error)) {
                    if (isset($error['message']) && trim((string) $error['message']) !== '') {
                        return trim((string) $error['message']);
                    }

                    foreach ($error as $item) {
                        if (is_string($item) && trim($item) !== '') {
                            return trim($item);
                        }
                    }
                }
            }
        }

        $message = trim((string) ($payload['message'] ?? ''));
        if ($message !== '') {
            return $message;
        }

        return trim((string) ($payload['error'] ?? ''));
    }

    private function normalizeUrl(string $url): ?string
    {
        $url = trim($url);
        if ($url === '') {
            return null;
        }

        if (preg_match('/^https?:\/\//i', $url) !== 1) {
            return null;
        }

        return $url;
    }

    private function formatAmount(float $amount): string
    {
        return number_format(round($amount, 8), 8, '.', '');
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function verifySignatureWithKey(array $payload, string $apiKey): bool
    {
        $sign = trim((string) ($payload['sign'] ?? ''));
        if ($sign === '' || $apiKey === '') {
            return false;
        }

        $signSource = $payload;
        unset($signSource['sign']);

        $encoded = json_encode($signSource, JSON_UNESCAPED_UNICODE);
        if ($encoded === false) {
            return false;
        }

        $expected = md5(base64_encode($encoded) . $apiKey);

        return hash_equals(strtolower($expected), strtolower($sign));
    }
}
