<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('auth-login', function (Request $request): array {
            $email = strtolower(trim((string) $request->input('email', 'unknown')));
            $ip = (string) $request->ip();
            $scope = "{$email}|{$ip}";

            return [
                Limit::perMinute(6)->by("auth-login:{$scope}"),
                Limit::perHour(40)->by("auth-login-hour:{$scope}"),
            ];
        });

        RateLimiter::for('auth-otp-request', function (Request $request): array {
            $email = strtolower(trim((string) $request->input('email', 'unknown')));
            $flow = strtolower(trim((string) $request->input('flow', 'unknown')));
            $ip = (string) $request->ip();
            $scope = "{$flow}:{$email}|{$ip}";

            return [
                Limit::perMinute(3)->by("auth-otp-request:{$scope}"),
                Limit::perHour(15)->by("auth-otp-request-hour:{$scope}"),
            ];
        });

        RateLimiter::for('auth-otp-verify', function (Request $request): array {
            $email = strtolower(trim((string) $request->input('email', 'unknown')));
            $flow = strtolower(trim((string) $request->input('flow', 'unknown')));
            $ip = (string) $request->ip();
            $scope = "{$flow}:{$email}|{$ip}";

            return [
                Limit::perMinute(10)->by("auth-otp-verify:{$scope}"),
                Limit::perHour(50)->by("auth-otp-verify-hour:{$scope}"),
            ];
        });

        RateLimiter::for('auth-password-reset-request', function (Request $request): array {
            $email = strtolower(trim((string) $request->input('email', 'unknown')));
            $ip = (string) $request->ip();
            $scope = "{$email}|{$ip}";

            return [
                Limit::perMinute(2)->by("auth-password-reset-request:{$scope}"),
                Limit::perHour(10)->by("auth-password-reset-request-hour:{$scope}"),
            ];
        });

        RateLimiter::for('auth-password-reset', function (Request $request): array {
            $email = strtolower(trim((string) $request->input('email', 'unknown')));
            $ip = (string) $request->ip();
            $scope = "{$email}|{$ip}";

            return [
                Limit::perMinute(5)->by("auth-password-reset:{$scope}"),
                Limit::perHour(30)->by("auth-password-reset-hour:{$scope}"),
            ];
        });

        RateLimiter::for('sensitive-action', function (Request $request): array {
            $userId = (string) (optional($request->user())->id ?? 'guest');
            $ip = (string) $request->ip();
            $scope = "{$userId}|{$ip}";

            return [
                Limit::perMinute(12)->by("sensitive-action:{$scope}"),
                Limit::perHour(120)->by("sensitive-action-hour:{$scope}"),
            ];
        });

        RateLimiter::for('provider-webhook', function (Request $request): Limit {
            return Limit::perMinute(240)->by((string) $request->ip());
        });
    }
}
