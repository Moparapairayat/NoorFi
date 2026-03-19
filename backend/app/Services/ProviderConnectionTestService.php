<?php

namespace App\Services;

use RuntimeException;

class ProviderConnectionTestService
{
    public function __construct(
        private readonly DiditService $didit,
        private readonly StrowalletService $strowallet,
        private readonly HeleketService $heleket,
        private readonly BinancePayService $binancePay,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function run(string $provider): array
    {
        return match (strtolower(trim($provider))) {
            'didit' => $this->runDidit(),
            'strowallet' => $this->runStrowallet(),
            'heleket_deposit' => $this->runHeleketDeposit(),
            'heleket_payout' => $this->runHeleketPayout(),
            'binance_pay' => $this->runBinancePay(),
            default => $this->warningResult(
                provider: $provider,
                title: 'Unknown Provider',
                message: 'Provider key is not recognized.',
            ),
        };
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function runAll(): array
    {
        return [
            $this->runDidit(),
            $this->runStrowallet(),
            $this->runHeleketDeposit(),
            $this->runHeleketPayout(),
            $this->runBinancePay(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function runDidit(): array
    {
        try {
            $this->didit->retrieveSessionDecision('health-check-' . now()->timestamp);

            return $this->successResult(
                provider: 'didit',
                title: 'Didit Connected',
                message: 'Didit API call succeeded.',
            );
        } catch (RuntimeException $exception) {
            return $this->analyzeException(
                provider: 'didit',
                message: $exception->getMessage(),
                titlePrefix: 'Didit',
                recoverableHints: [
                    'http 400',
                    'http 404',
                    'not found',
                    'session',
                    'invalid',
                ],
                authHints: [
                    'http 401',
                    'http 403',
                    'unauthorized',
                    'forbidden',
                    'invalid api key',
                    'invalid token',
                ],
            );
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function runStrowallet(): array
    {
        try {
            $this->strowallet->fetchCardTransactions('health-check-' . now()->timestamp);

            return $this->successResult(
                provider: 'strowallet',
                title: 'Strowallet Connected',
                message: 'Strowallet API call succeeded.',
            );
        } catch (RuntimeException $exception) {
            return $this->analyzeException(
                provider: 'strowallet',
                message: $exception->getMessage(),
                titlePrefix: 'Strowallet',
                recoverableHints: [
                    'http 400',
                    'not found',
                    'card',
                    'invalid card',
                    'card id',
                ],
                authHints: [
                    'http 401',
                    'http 403',
                    'unauthorized',
                    'forbidden',
                    'invalid key',
                    'invalid api key',
                    'authorization',
                ],
            );
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function runHeleketDeposit(): array
    {
        try {
            $services = $this->heleket->paymentServices();

            if ($services === []) {
                return $this->warningResult(
                    provider: 'heleket_deposit',
                    title: 'Heleket Deposit Warning',
                    message: 'Connected, but no payment services were returned.',
                );
            }

            return $this->successResult(
                provider: 'heleket_deposit',
                title: 'Heleket Deposit Connected',
                message: 'Connected. Available payment services: ' . count($services) . '.',
            );
        } catch (RuntimeException $exception) {
            return $this->analyzeException(
                provider: 'heleket_deposit',
                message: $exception->getMessage(),
                titlePrefix: 'Heleket Deposit',
                recoverableHints: [],
                authHints: [
                    'merchant id',
                    'api key',
                    'sign',
                    'unauthorized',
                    'forbidden',
                    'http 401',
                    'http 403',
                ],
            );
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function runHeleketPayout(): array
    {
        try {
            $services = $this->heleket->payoutServices();

            if ($services === []) {
                return $this->warningResult(
                    provider: 'heleket_payout',
                    title: 'Heleket Payout Warning',
                    message: 'Connected, but no payout services were returned.',
                );
            }

            return $this->successResult(
                provider: 'heleket_payout',
                title: 'Heleket Payout Connected',
                message: 'Connected. Available payout services: ' . count($services) . '.',
            );
        } catch (RuntimeException $exception) {
            return $this->analyzeException(
                provider: 'heleket_payout',
                message: $exception->getMessage(),
                titlePrefix: 'Heleket Payout',
                recoverableHints: [],
                authHints: [
                    'merchant id',
                    'api key',
                    'sign',
                    'unauthorized',
                    'forbidden',
                    'http 401',
                    'http 403',
                ],
            );
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function runBinancePay(): array
    {
        try {
            $reference = 'HEALTH-' . now()->format('YmdHis') . '-' . random_int(100, 999);
            $this->binancePay->queryOrderByMerchantTradeNo($reference);

            return $this->successResult(
                provider: 'binance_pay',
                title: 'Binance Pay Connected',
                message: 'Binance Pay query succeeded.',
            );
        } catch (RuntimeException $exception) {
            return $this->analyzeException(
                provider: 'binance_pay',
                message: $exception->getMessage(),
                titlePrefix: 'Binance Pay',
                recoverableHints: [
                    'order',
                    'merchanttradeno',
                    'not found',
                    'does not exist',
                    'unknown',
                ],
                authHints: [
                    'signature',
                    'certificate',
                    'unauthorized',
                    'forbidden',
                    'invalid api key',
                    'invalid key',
                    'http 401',
                    'http 403',
                ],
            );
        }
    }

    /**
     * @param  array<int, string>  $recoverableHints
     * @param  array<int, string>  $authHints
     * @return array<string, mixed>
     */
    private function analyzeException(
        string $provider,
        string $message,
        string $titlePrefix,
        array $recoverableHints,
        array $authHints
    ): array {
        $normalized = strtolower(trim($message));

        if ($this->containsAny($normalized, ['not configured', 'configuration is incomplete'])) {
            return $this->errorResult(
                provider: $provider,
                title: "{$titlePrefix} Config Missing",
                message: $this->shortMessage($message),
            );
        }

        if ($this->containsAny($normalized, $authHints)) {
            return $this->errorResult(
                provider: $provider,
                title: "{$titlePrefix} Auth Failed",
                message: $this->shortMessage($message),
            );
        }

        if ($this->containsAny($normalized, $recoverableHints)) {
            return $this->successResult(
                provider: $provider,
                title: "{$titlePrefix} Reachable",
                message: 'Provider responded (validation-level response): ' . $this->shortMessage($message),
            );
        }

        return $this->warningResult(
            provider: $provider,
            title: "{$titlePrefix} Uncertain",
            message: $this->shortMessage($message),
        );
    }

    private function containsAny(string $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            if ($needle !== '' && str_contains($haystack, strtolower($needle))) {
                return true;
            }
        }

        return false;
    }

    private function shortMessage(string $message): string
    {
        $clean = trim(preg_replace('/\s+/', ' ', $message) ?? '');

        return mb_strlen($clean) > 220
            ? mb_substr($clean, 0, 220) . '...'
            : $clean;
    }

    /**
     * @return array<string, mixed>
     */
    private function successResult(string $provider, string $title, string $message): array
    {
        return [
            'provider' => $provider,
            'status' => 'success',
            'title' => $title,
            'message' => $message,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function warningResult(string $provider, string $title, string $message): array
    {
        return [
            'provider' => $provider,
            'status' => 'warning',
            'title' => $title,
            'message' => $message,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function errorResult(string $provider, string $title, string $message): array
    {
        return [
            'provider' => $provider,
            'status' => 'danger',
            'title' => $title,
            'message' => $message,
        ];
    }
}

