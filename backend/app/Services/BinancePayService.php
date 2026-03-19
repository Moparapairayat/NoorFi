<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class BinancePayService
{
    private string $apiKey;

    private string $apiSecret;

    private string $merchantId;

    private string $baseUrl;

    private ?string $returnUrl;

    private ?string $cancelUrl;

    private ?string $webhookUrl;

    private int $timeoutSeconds;

    public function __construct()
    {
        $this->apiKey = trim((string) config('services.binance_pay.api_key', ''));
        $this->apiSecret = trim((string) config('services.binance_pay.api_secret', ''));
        $this->merchantId = trim((string) config('services.binance_pay.merchant_id', ''));
        $this->baseUrl = rtrim(trim((string) config('services.binance_pay.base_url', 'https://bpay.binanceapi.com')), '/');
        $this->returnUrl = $this->normalizeUrl((string) config('services.binance_pay.return_url', ''));
        $this->cancelUrl = $this->normalizeUrl((string) config('services.binance_pay.cancel_url', ''));
        $this->webhookUrl = $this->normalizeUrl((string) config('services.binance_pay.webhook_url', ''));
        $this->timeoutSeconds = max((int) config('services.binance_pay.timeout_seconds', 25), 5);
    }

    /**
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function createOrder(
        float $amount,
        string $currency,
        string $merchantTradeNo,
        array $options = []
    ): array {
        $this->assertConfigured();

        $payload = array_filter([
            'merchantId' => $this->merchantId !== '' ? (int) $this->merchantId : null,
            'merchantTradeNo' => trim($merchantTradeNo),
            'tradeType' => strtoupper((string) ($options['trade_type'] ?? 'APP')),
            'totalFee' => $this->formatAmount($amount),
            'currency' => strtoupper(trim($currency)),
            'productType' => trim((string) ($options['product_type'] ?? 'wallet_topup')),
            'productName' => trim((string) ($options['product_name'] ?? 'NoorFi Wallet Top Up')),
            'productDetail' => trim((string) ($options['product_detail'] ?? 'Instant Binance Pay wallet funding')),
            'orderExpireTime' => (int) ($options['order_expire_time'] ?? (now()->addMinutes(15)->valueOf())),
            'supportPayCurrency' => trim((string) ($options['support_pay_currency'] ?? strtoupper(trim($currency)))),
            'returnUrl' => $options['return_url'] ?? $this->returnUrl,
            'cancelUrl' => $options['cancel_url'] ?? $this->cancelUrl,
            'webhookUrl' => $options['webhook_url'] ?? $this->webhookUrl,
        ], static fn ($value) => $value !== null && $value !== '');

        $response = $this->request(
            method: 'POST',
            path: '/binancepay/openapi/order',
            payload: $payload,
            operation: 'create order',
        );

        $result = data_get($response, 'data');
        if (! is_array($result)) {
            throw new RuntimeException('Binance Pay create order failed: missing data payload.');
        }

        return $result;
    }

    /**
     * @return array<string, mixed>
     */
    public function queryOrderByMerchantTradeNo(string $merchantTradeNo): array
    {
        $this->assertConfigured();

        $payload = array_filter([
            'merchantId' => $this->merchantId !== '' ? (int) $this->merchantId : null,
            'merchantTradeNo' => trim($merchantTradeNo),
        ], static fn ($value) => $value !== null && $value !== '');

        $response = $this->request(
            method: 'POST',
            path: '/binancepay/openapi/order/query',
            payload: $payload,
            operation: 'query order',
        );

        $result = data_get($response, 'data');
        if (! is_array($result)) {
            throw new RuntimeException('Binance Pay query order failed: missing data payload.');
        }

        return $result;
    }

    private function assertConfigured(): void
    {
        if ($this->apiKey === '') {
            throw new RuntimeException('Binance Pay API key is not configured.');
        }

        if ($this->apiSecret === '') {
            throw new RuntimeException('Binance Pay API secret is not configured.');
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function request(string $method, string $path, array $payload, string $operation): array
    {
        $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($jsonPayload === false) {
            throw new RuntimeException("Unable to encode Binance Pay payload for {$operation}.");
        }

        $timestamp = (string) now()->valueOf();
        $nonce = bin2hex(random_bytes(16));
        $signaturePayload = "{$timestamp}\n{$nonce}\n{$jsonPayload}\n";
        $signature = strtoupper(hash_hmac('sha512', $signaturePayload, $this->apiSecret));

        $response = Http::acceptJson()
            ->timeout($this->timeoutSeconds)
            ->withHeaders([
                'Content-Type' => 'application/json',
                'BinancePay-Timestamp' => $timestamp,
                'BinancePay-Nonce' => $nonce,
                'BinancePay-Certificate-SN' => $this->apiKey,
                'BinancePay-Signature' => $signature,
            ])
            ->withBody($jsonPayload, 'application/json')
            ->send(strtoupper($method), $this->baseUrl . $path);

        return $this->decodeResponse($response, $operation);
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeResponse(Response $response, string $operation): array
    {
        $payload = $response->json();
        if (! is_array($payload)) {
            throw new RuntimeException("Binance Pay {$operation} failed with invalid response format.");
        }

        if (! $response->successful()) {
            $message = $this->extractErrorMessage($payload);
            throw new RuntimeException(
                "Binance Pay {$operation} failed with HTTP {$response->status()}: "
                . ($message !== '' ? $message : 'Unexpected provider response.')
            );
        }

        $status = strtoupper(trim((string) ($payload['status'] ?? '')));
        $code = trim((string) ($payload['code'] ?? ''));
        if ($status !== 'SUCCESS' || $code !== '000000') {
            $message = $this->extractErrorMessage($payload);
            throw new RuntimeException(
                "Binance Pay {$operation} rejected: " . ($message !== '' ? $message : 'Unknown provider error.')
            );
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function extractErrorMessage(array $payload): string
    {
        $message = trim((string) ($payload['errorMessage'] ?? ''));
        if ($message !== '') {
            return $message;
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
        return rtrim(rtrim(number_format(round($amount, 8), 8, '.', ''), '0'), '.');
    }
}

