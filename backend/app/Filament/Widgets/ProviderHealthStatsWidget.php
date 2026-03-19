<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\SystemSettings\SystemSettingResource;
use App\Models\User;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class ProviderHealthStatsWidget extends StatsOverviewWidget
{
    protected static ?int $sort = 3;

    protected int|string|array $columnSpan = 'full';

    protected ?string $pollingInterval = '20s';

    public static function canView(): bool
    {
        $user = auth()->user();

        return $user instanceof User && $user->hasAnyPanelRole([
            User::ADMIN_ROLE_SUPER_ADMIN,
            User::ADMIN_ROLE_OPERATIONS,
            User::ADMIN_ROLE_COMPLIANCE,
        ]);
    }

    /**
     * @return array<Stat>
     */
    protected function getStats(): array
    {
        $didit = $this->check([
            'services.didit.api_key',
            'services.didit.workflow_id',
            'services.didit.webhook_secret',
        ]);

        $strowallet = $this->check([
            'services.strowallet.public_key',
            'services.strowallet.secret_key',
            'services.strowallet.create_card_endpoint',
        ]);

        $heleketDeposit = $this->check([
            'services.heleket.merchant_id',
            'services.heleket.payment_api_key',
            'services.heleket.callback_url',
        ]);

        $heleketPayout = $this->check([
            'services.heleket.merchant_id',
            'services.heleket.payout_api_key',
            'services.heleket.payout_callback_url',
        ]);

        $binancePay = $this->check([
            'services.binance_pay.api_key',
            'services.binance_pay.api_secret',
            'services.binance_pay.merchant_id',
        ]);

        return [
            $this->makeProviderStat('Didit KYC', $didit),
            $this->makeProviderStat('Strowallet', $strowallet),
            $this->makeProviderStat('Heleket Deposit', $heleketDeposit),
            $this->makeProviderStat('Heleket Payout', $heleketPayout),
            $this->makeProviderStat('Binance Pay', $binancePay),
        ];
    }

    /**
     * @param  array<string, mixed>  $result
     */
    private function makeProviderStat(string $label, array $result): Stat
    {
        $missing = (int) ($result['missing_count'] ?? 0);
        $statusLabel = $missing === 0 ? 'Ready' : "Missing {$missing}";
        $description = $missing === 0
            ? 'Config complete'
            : implode(', ', (array) ($result['missing_keys'] ?? []));

        return Stat::make($label, $statusLabel)
            ->description($description)
            ->descriptionIcon('heroicon-m-signal')
            ->color((string) ($result['color'] ?? 'warning'))
            ->url(SystemSettingResource::getUrl());
    }

    /**
     * @param  array<int, string>  $keys
     * @return array<string, mixed>
     */
    private function check(array $keys): array
    {
        $missing = [];

        foreach ($keys as $key) {
            $value = config($key);
            if (! $this->hasValue($value)) {
                $missing[] = $key;
            }
        }

        return [
            'missing_count' => count($missing),
            'missing_keys' => $missing,
            'color' => count($missing) === 0 ? 'success' : 'warning',
        ];
    }

    private function hasValue(mixed $value): bool
    {
        if (is_string($value)) {
            return trim($value) !== '';
        }

        if (is_bool($value)) {
            return true;
        }

        if (is_numeric($value)) {
            return true;
        }

        return ! empty($value);
    }
}
