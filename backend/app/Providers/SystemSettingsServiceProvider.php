<?php

namespace App\Providers;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;
use Throwable;

class SystemSettingsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->applyRuntimeConfigOverrides();
    }

    private function applyRuntimeConfigOverrides(): void
    {
        try {
            if (! Schema::hasTable('system_settings')) {
                return;
            }

            $overrides = SystemSetting::cachedConfigMap();
            if ($overrides === []) {
                return;
            }

            foreach ($overrides as $key => $value) {
                config([(string) $key => $value]);
            }
        } catch (Throwable $exception) {
            if (! app()->runningInConsole()) {
                Log::warning('System settings could not be loaded from database.', [
                    'error' => $exception->getMessage(),
                ]);
            }
        }
    }
}

