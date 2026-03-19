<?php

use App\Services\ProviderSyncService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('providers:sync-pending {--deposits-limit=120} {--withdrawals-limit=120}', function (ProviderSyncService $sync): void {
    $depositsLimit = max((int) $this->option('deposits-limit'), 1);
    $withdrawalsLimit = max((int) $this->option('withdrawals-limit'), 1);

    $result = $sync->syncPending($depositsLimit, $withdrawalsLimit);

    $this->info('Provider sync complete.');
    $this->line('Deposits: ' . json_encode($result['deposits'], JSON_UNESCAPED_SLASHES));
    $this->line('Withdrawals: ' . json_encode($result['withdrawals'], JSON_UNESCAPED_SLASHES));
})->purpose('Sync pending provider payments/payouts and reconcile wallet balances.');

Schedule::command('providers:sync-pending --deposits-limit=120 --withdrawals-limit=120')
    ->everyMinute()
    ->withoutOverlapping();
