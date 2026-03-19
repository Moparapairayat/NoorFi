<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class SystemHealthController extends Controller
{
    public function providerHealth(): JsonResponse
    {
        $appEnv = (string) config('app.env', 'production');
        $appDebug = (bool) config('app.debug', false);
        $queueConnection = (string) config('queue.default', 'sync');

        $appWarnings = [];
        if ($appEnv !== 'production') {
            $appWarnings[] = 'APP_ENV should be production on live deployment.';
        }
        if ($appDebug) {
            $appWarnings[] = 'APP_DEBUG should be false on live deployment.';
        }
        if ($queueConnection === 'sync') {
            $appWarnings[] = 'QUEUE_CONNECTION=sync can block requests under load.';
        }

        $mailer = (string) config('mail.default', 'smtp');
        $mailFromAddress = (string) config('mail.from.address', '');
        $mailRequired = [
            'mail.from.address' => $mailFromAddress,
        ];

        if ($mailer === 'resend') {
            $mailRequired['services.resend.key'] = (string) config('services.resend.key', '');
        }

        $strowalletRequired = [
            'services.strowallet.public_key' => (string) config('services.strowallet.public_key', ''),
            'services.strowallet.secret_key' => (string) config('services.strowallet.secret_key', ''),
            'services.strowallet.create_card_endpoint' => (string) config('services.strowallet.create_card_endpoint', ''),
            'services.strowallet.card_details_endpoint' => (string) config('services.strowallet.card_details_endpoint', ''),
            'services.strowallet.freeze_unfreeze_endpoint' => (string) config('services.strowallet.freeze_unfreeze_endpoint', ''),
        ];

        $diditRequired = [
            'services.didit.api_key' => (string) config('services.didit.api_key', ''),
            'services.didit.workflow_id' => (string) config('services.didit.workflow_id', ''),
            'services.didit.callback_url' => (string) config('services.didit.callback_url', ''),
            'services.didit.webhook_secret' => (string) config('services.didit.webhook_secret', ''),
        ];

        $heleketDepositRequired = [
            'services.heleket.merchant_id' => (string) config('services.heleket.merchant_id', ''),
            'services.heleket.payment_api_key' => (string) config('services.heleket.payment_api_key', ''),
            'services.heleket.callback_url' => (string) config('services.heleket.callback_url', ''),
        ];

        $heleketPayoutRequired = [
            'services.heleket.merchant_id' => (string) config('services.heleket.merchant_id', ''),
            'services.heleket.payout_api_key' => (string) config('services.heleket.payout_api_key', ''),
            'services.heleket.payout_callback_url' => (string) config('services.heleket.payout_callback_url', ''),
        ];

        $checks = [
            'app_runtime' => [
                'status' => count($appWarnings) === 0 ? 'ok' : 'warning',
                'warnings' => $appWarnings,
                'meta' => [
                    'app_env' => $appEnv,
                    'app_debug' => $appDebug,
                    'queue_connection' => $queueConnection,
                ],
            ],
            'mail' => $this->buildCheckResult(
                required: $mailRequired,
                meta: [
                    'mailer' => $mailer,
                    'from_address' => $mailFromAddress !== '',
                ]
            ),
            'strowallet' => $this->buildCheckResult(
                required: $strowalletRequired,
                warnings: [
                    (string) config('services.strowallet.mode', '') === 'sandbox'
                        ? 'Strowallet is configured in sandbox mode.'
                        : null,
                ],
                meta: [
                    'mode' => (string) config('services.strowallet.mode', ''),
                    'card_type' => (string) config('services.strowallet.card_type', 'mastercard'),
                ]
            ),
            'didit' => $this->buildCheckResult(
                required: $diditRequired,
                meta: [
                    'base_url' => (string) config('services.didit.base_url', ''),
                ]
            ),
            'heleket_deposit' => $this->buildCheckResult(
                required: $heleketDepositRequired,
                meta: [
                    'base_url' => (string) config('services.heleket.base_url', ''),
                ]
            ),
            'heleket_payout' => $this->buildCheckResult(
                required: $heleketPayoutRequired,
                meta: [
                    'base_url' => (string) config('services.heleket.base_url', ''),
                ]
            ),
        ];

        $overallStatus = 'ok';
        foreach ($checks as $check) {
            if (($check['status'] ?? 'ok') === 'error') {
                $overallStatus = 'degraded';
                break;
            }
            if (($check['status'] ?? 'ok') === 'warning') {
                $overallStatus = 'warning';
            }
        }

        return response()->json([
            'status' => $overallStatus,
            'generated_at' => now()->toIso8601String(),
            'checks' => $checks,
        ]);
    }

    /**
     * @param  array<string, string>  $required
     * @param  array<int, string|null>  $warnings
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    private function buildCheckResult(array $required, array $warnings = [], array $meta = []): array
    {
        $missing = [];
        foreach ($required as $key => $value) {
            if (! $this->hasConfigValue($value)) {
                $missing[] = $key;
            }
        }

        $activeWarnings = array_values(array_filter($warnings, static fn (?string $item): bool => $item !== null && trim($item) !== ''));
        $status = count($missing) > 0
            ? 'error'
            : (count($activeWarnings) > 0 ? 'warning' : 'ok');

        return [
            'status' => $status,
            'missing' => $missing,
            'warnings' => $activeWarnings,
            'meta' => $meta,
        ];
    }

    private function hasConfigValue(mixed $value): bool
    {
        if (is_string($value)) {
            return trim($value) !== '';
        }

        return ! empty($value);
    }
}

