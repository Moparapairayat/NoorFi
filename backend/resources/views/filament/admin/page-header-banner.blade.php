@php
    use App\Filament\Pages\OperationsWorkflowCenterPage;
    use App\Filament\Resources\Deposits\DepositResource;
    use App\Filament\Resources\KycProfiles\KycProfileResource;
    use App\Filament\Resources\SystemSettings\SystemSettingResource;
    use App\Filament\Resources\Withdrawals\WithdrawalResource;
    use App\Models\Deposit;
    use App\Models\KycProfile;
    use App\Models\SystemSetting;
    use App\Models\Withdrawal;

    $pendingDeposits = Deposit::query()->whereIn('status', ['pending', 'processing'])->count();
    $pendingWithdrawals = Withdrawal::query()->whereIn('status', ['pending', 'processing'])->count();
    $pendingKyc = KycProfile::query()->whereIn('status', ['submitted', 'in_review'])->count();
    $missingSettings = SystemSetting::query()->whereNull('value')->count();
    $isProduction = app()->environment('production');

    $canWorkflow = OperationsWorkflowCenterPage::canAccess();
    $canDeposits = DepositResource::canViewAny();
    $canWithdrawals = WithdrawalResource::canViewAny();
    $canKyc = KycProfileResource::canViewAny();
    $canSettings = SystemSettingResource::canViewAny();
@endphp

@auth
<div class="nf-admin-banner">
    <div class="nf-admin-banner__chips">
        <span class="nf-chip">{{ $isProduction ? 'LIVE' : 'SANDBOX' }}</span>
        @if ($canDeposits)
            <span class="nf-chip">Deposits <b>{{ $pendingDeposits }}</b></span>
        @endif
        @if ($canWithdrawals)
            <span class="nf-chip">Withdrawals <b>{{ $pendingWithdrawals }}</b></span>
        @endif
        @if ($canKyc)
            <span class="nf-chip">KYC <b>{{ $pendingKyc }}</b></span>
        @endif
        @if ($canSettings)
            <span class="nf-chip">Missing Keys <b>{{ $missingSettings }}</b></span>
        @endif
    </div>

    <div class="nf-admin-banner__actions">
        @if ($canWorkflow)
            <a class="nf-action nf-action--primary" href="{{ OperationsWorkflowCenterPage::getUrl() }}">
                Workflow Center
            </a>
        @endif
        @if ($canKyc)
            <a class="nf-action" href="{{ KycProfileResource::getUrl() }}">
                KYC Desk
            </a>
        @endif
        @if ($canSettings)
            <a class="nf-action" href="{{ SystemSettingResource::getUrl() }}">
                Settings
            </a>
        @endif
    </div>
</div>
@endauth
