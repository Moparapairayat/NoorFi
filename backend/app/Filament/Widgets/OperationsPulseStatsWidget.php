<?php

namespace App\Filament\Widgets;

use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Resources\Deposits\DepositResource;
use App\Filament\Resources\KycProfiles\KycProfileResource;
use App\Filament\Resources\Withdrawals\WithdrawalResource;
use App\Models\Deposit;
use App\Models\Exchange;
use App\Models\KycProfile;
use App\Models\Transfer;
use App\Models\User;
use App\Models\Withdrawal;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class OperationsPulseStatsWidget extends StatsOverviewWidget
{
    protected static ?int $sort = 2;

    protected int|string|array $columnSpan = 'full';

    protected ?string $pollingInterval = '20s';

    public static function canView(): bool
    {
        $user = auth()->user();

        return $user instanceof User && $user->hasAnyPanelRole([
            User::ADMIN_ROLE_SUPER_ADMIN,
            User::ADMIN_ROLE_OPERATIONS,
        ]);
    }

    /**
     * @return array<Stat>
     */
    protected function getStats(): array
    {
        $windowStart = now()->subDay();

        $totalOperations24h = Deposit::query()->where('created_at', '>=', $windowStart)->count()
            + Withdrawal::query()->where('created_at', '>=', $windowStart)->count()
            + Transfer::query()->where('created_at', '>=', $windowStart)->count()
            + Exchange::query()->where('created_at', '>=', $windowStart)->count();

        $completedOperations24h = Deposit::query()->where('created_at', '>=', $windowStart)->where('status', 'completed')->count()
            + Withdrawal::query()->where('created_at', '>=', $windowStart)->where('status', 'completed')->count()
            + Transfer::query()->where('created_at', '>=', $windowStart)->where('status', 'completed')->count()
            + Exchange::query()->where('created_at', '>=', $windowStart)->where('status', 'completed')->count();

        $failedOperations24h = Deposit::query()->where('created_at', '>=', $windowStart)->whereIn('status', ['failed', 'cancelled'])->count()
            + Withdrawal::query()->where('created_at', '>=', $windowStart)->whereIn('status', ['failed', 'cancelled'])->count()
            + Transfer::query()->where('created_at', '>=', $windowStart)->whereIn('status', ['failed', 'cancelled'])->count()
            + Exchange::query()->where('created_at', '>=', $windowStart)->whereIn('status', ['failed', 'cancelled'])->count();

        $successRate = $totalOperations24h > 0
            ? round(($completedOperations24h / $totalOperations24h) * 100, 1)
            : 100.0;

        $pendingBacklog = Deposit::query()->whereIn('status', ['pending', 'processing'])->count()
            + Withdrawal::query()->whereIn('status', ['pending', 'processing'])->count()
            + Transfer::query()->whereIn('status', ['pending', 'processing'])->count()
            + Exchange::query()->whereIn('status', ['pending', 'processing'])->count();

        $kycPending = KycProfile::query()
            ->whereIn('status', ['submitted', 'in_review'])
            ->count();

        return [
            Stat::make('24h Success Rate', "{$successRate}%")
                ->description("Completed {$completedOperations24h} of {$totalOperations24h} operations")
                ->descriptionIcon('heroicon-m-check-badge')
                ->color($successRate >= 90 ? 'success' : ($successRate >= 75 ? 'warning' : 'danger'))
                ->url(OperationsWorkflowCenterPage::getUrl()),

            Stat::make('24h Failed Ops', (string) $failedOperations24h)
                ->description('Failed + cancelled operations in last 24 hours')
                ->descriptionIcon('heroicon-m-x-circle')
                ->color($failedOperations24h > 0 ? 'danger' : 'success')
                ->url(WithdrawalResource::getUrl()),

            Stat::make('Pending Backlog', (string) $pendingBacklog)
                ->description('Deposits, withdrawals, transfers, exchanges waiting')
                ->descriptionIcon('heroicon-m-clock')
                ->color($pendingBacklog > 0 ? 'warning' : 'success')
                ->url(DepositResource::getUrl()),

            Stat::make('KYC Waiting', (string) $kycPending)
                ->description('Submitted and in-review compliance queue')
                ->descriptionIcon('heroicon-m-shield-check')
                ->color($kycPending > 0 ? 'warning' : 'success')
                ->url(KycProfileResource::getUrl()),
        ];
    }
}
