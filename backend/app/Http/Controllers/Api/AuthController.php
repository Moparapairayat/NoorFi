<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OtpVerification;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class AuthController extends Controller
{
    public function requestPasswordResetOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc,dns'],
        ]);

        $email = strtolower(trim((string) $data['email']));
        $user = User::query()->where('email', $email)->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'email' => 'No account found with this email address.',
            ]);
        }

        OtpVerification::query()
            ->where('email', $email)
            ->where('flow', 'password_reset')
            ->whereNull('consumed_at')
            ->delete();

        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $otpRecord = OtpVerification::query()->create([
            'email' => $email,
            'flow' => 'password_reset',
            'code' => $otp,
            'expires_at' => now()->addMinutes(10),
            'ip_address' => $request->ip(),
        ]);

        try {
            Mail::send(
                [
                    'html' => 'emails.otp',
                    'text' => 'emails.otp_plain',
                ],
                [
                    'otp' => $otp,
                    'flowTitle' => 'Password Reset',
                    'actionLabel' => 'Account recovery',
                    'expiresMinutes' => 10,
                    'email' => $email,
                    'appName' => config('app.name', 'NoorFi'),
                    'supportEmail' => config('mail.from.address'),
                ],
                function ($message) use ($email): void {
                    $message
                        ->to($email)
                        ->subject('NoorFi OTP - Password Reset');
                }
            );
        } catch (Throwable $exception) {
            Log::error('Failed to send password reset OTP email.', [
                'email' => $email,
                'error' => $exception->getMessage(),
            ]);

            $otpRecord->delete();

            throw ValidationException::withMessages([
                'email' => 'Unable to send OTP email right now. Please try again.',
            ]);
        }

        $response = [
            'message' => 'Password reset OTP sent successfully.',
            'email' => $email,
            'expires_in_seconds' => 600,
        ];

        if (config('app.otp_debug_expose', false) === true) {
            $response['otp_code'] = $otp;
        }

        return response()->json($response);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc,dns'],
            'code' => ['required', 'digits:6'],
            'password' => ['required', 'string', 'min:8', 'max:72', 'confirmed'],
        ]);

        $email = strtolower(trim((string) $data['email']));
        $user = User::query()->where('email', $email)->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'email' => 'No account found with this email address.',
            ]);
        }

        $otpRecord = OtpVerification::query()
            ->where('email', $email)
            ->where('flow', 'password_reset')
            ->active()
            ->latest('id')
            ->first();

        if (! $otpRecord) {
            throw ValidationException::withMessages([
                'code' => 'OTP expired or invalid. Please request a new code.',
            ]);
        }

        if (! hash_equals($otpRecord->code, (string) $data['code'])) {
            $otpRecord->increment('attempts');

            if ($otpRecord->attempts >= 5) {
                $otpRecord->update(['consumed_at' => now()]);
            }

            throw ValidationException::withMessages([
                'code' => 'Incorrect OTP code.',
            ]);
        }

        DB::transaction(function () use ($otpRecord, $user, $data): void {
            $otpRecord->update(['consumed_at' => now()]);

            $user->forceFill([
                'password' => (string) $data['password'],
                'email_verified_at' => $user->email_verified_at ?? now(),
            ])->save();

            $user->tokens()->delete();
        });

        return response()->json([
            'message' => 'Password reset successful. Please sign in with your new password.',
        ]);
    }

    public function loginWithPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc,dns'],
            'password' => ['required', 'string', 'min:8', 'max:72'],
        ]);

        $email = strtolower(trim((string) $data['email']));
        $user = User::query()->where('email', $email)->first();

        if (! $user || ! Hash::check((string) $data['password'], (string) $user->getAuthPassword())) {
            throw ValidationException::withMessages([
                'email' => 'Invalid email or password.',
            ]);
        }

        $user->forceFill([
            'last_login_at' => now(),
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        $this->ensureDefaultWallets($user);
        $token = $user->createToken('mobile-login-password')->plainTextToken;

        return response()->json([
            'message' => 'Login successful.',
            'flow' => 'login',
            'token_type' => 'Bearer',
            'access_token' => $token,
            'requires_pin_setup' => empty($user->transaction_pin),
            'user' => [
                'id' => $user->id,
                'name' => $user->full_name ?: $user->name,
                'email' => $user->email,
                'phone_number' => $user->phone_number,
                'kyc_status' => $user->kyc_status,
                'account_status' => $user->account_status,
            ],
        ]);
    }

    public function requestOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc,dns'],
            'flow' => ['required', Rule::in(['login', 'signup', 'recovery'])],
            'phone_number' => ['required_if:flow,signup', 'string', 'min:8', 'max:24'],
        ]);

        $email = strtolower(trim($data['email']));
        $flow = $data['flow'];
        $phoneNumber = preg_replace('/\s+/', '', trim((string) ($data['phone_number'] ?? '')));
        if ($phoneNumber === '') {
            $phoneNumber = null;
        }

        if ($flow === 'signup' && $phoneNumber !== null) {
            $phoneOwnerExists = User::query()
                ->where('phone_number', $phoneNumber)
                ->exists();

            if ($phoneOwnerExists) {
                throw ValidationException::withMessages([
                    'phone_number' => 'This mobile number is already used by another account.',
                ]);
            }
        }
        $user = User::query()->where('email', $email)->first();

        if ($flow === 'signup' && $user) {
            throw ValidationException::withMessages([
                'email' => 'An account already exists with this email.',
            ]);
        }

        if (in_array($flow, ['login', 'recovery'], true) && ! $user) {
            throw ValidationException::withMessages([
                'email' => 'No account found with this email address.',
            ]);
        }

        OtpVerification::query()
            ->where('email', $email)
            ->where('flow', $flow)
            ->whereNull('consumed_at')
            ->delete();

        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $otpRecord = OtpVerification::query()->create([
            'email' => $email,
            'flow' => $flow,
            'code' => $otp,
            'expires_at' => now()->addMinutes(10),
            'ip_address' => $request->ip(),
        ]);

        try {
            $flowTitle = match ($flow) {
                'signup' => 'Create Account',
                'login' => 'Sign In',
                default => 'Recover Access',
            };

            $actionLabel = match ($flow) {
                'signup' => 'Account setup',
                'login' => 'Login approval',
                default => 'Security recovery',
            };

            Mail::send(
                [
                    'html' => 'emails.otp',
                    'text' => 'emails.otp_plain',
                ],
                [
                    'otp' => $otp,
                    'flowTitle' => $flowTitle,
                    'actionLabel' => $actionLabel,
                    'expiresMinutes' => 10,
                    'email' => $email,
                    'appName' => config('app.name', 'NoorFi'),
                    'supportEmail' => config('mail.from.address'),
                ],
                function ($message) use ($email, $flowTitle): void {
                    $message
                        ->to($email)
                        ->subject("NoorFi OTP - {$flowTitle}");
                }
            );
        } catch (Throwable $exception) {
            Log::error('Failed to send OTP email.', [
                'email' => $email,
                'flow' => $flow,
                'error' => $exception->getMessage(),
            ]);

            $otpRecord->delete();

            throw ValidationException::withMessages([
                'email' => 'Unable to send OTP email right now. Please try again.',
            ]);
        }

        $response = [
            'message' => 'OTP sent successfully.',
            'email' => $email,
            'flow' => $flow,
            'phone_number' => $phoneNumber,
            'expires_in_seconds' => 600,
        ];

        if (config('app.otp_debug_expose', false) === true) {
            $response['otp_code'] = $otp;
        }

        return response()->json($response);
    }

    public function verifyOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc,dns'],
            'flow' => ['required', Rule::in(['login', 'signup', 'recovery'])],
            'code' => ['required', 'digits:6'],
            'full_name' => ['nullable', 'string', 'min:3', 'max:120'],
            'password' => ['required_if:flow,signup', 'string', 'min:8', 'max:72', 'confirmed'],
            'phone_number' => ['required_if:flow,signup', 'string', 'min:8', 'max:24'],
        ]);

        $email = strtolower(trim($data['email']));
        $flow = $data['flow'];
        $phoneNumber = preg_replace('/\s+/', '', trim((string) ($data['phone_number'] ?? '')));
        if ($phoneNumber === '') {
            $phoneNumber = null;
        }

        $otpRecord = OtpVerification::query()
            ->where('email', $email)
            ->where('flow', $flow)
            ->active()
            ->latest('id')
            ->first();

        if (! $otpRecord) {
            throw ValidationException::withMessages([
                'code' => 'OTP expired or invalid. Please request a new code.',
            ]);
        }

        if (! hash_equals($otpRecord->code, $data['code'])) {
            $otpRecord->increment('attempts');

            if ($otpRecord->attempts >= 5) {
                $otpRecord->update(['consumed_at' => now()]);
            }

            throw ValidationException::withMessages([
                'code' => 'Incorrect OTP code.',
            ]);
        }

        $user = DB::transaction(function () use ($flow, $email, $phoneNumber, $data, $otpRecord) {
            $otpRecord->update(['consumed_at' => now()]);

            if ($flow === 'signup') {
                $fullName = trim((string) ($data['full_name'] ?? ''));

                $user = User::query()->create([
                    'name' => $fullName !== '' ? $fullName : strstr($email, '@', true),
                    'full_name' => $fullName !== '' ? $fullName : null,
                    'email' => $email,
                    'phone_number' => $phoneNumber,
                    'password' => (string) $data['password'],
                    'email_verified_at' => now(),
                ]);

                $this->ensureDefaultWallets($user);

                return $user;
            }

            $user = User::query()->where('email', $email)->firstOrFail();

            if ($flow === 'login') {
                $user->forceFill([
                    'last_login_at' => now(),
                    'email_verified_at' => $user->email_verified_at ?? now(),
                ])->save();
            }

            $this->ensureDefaultWallets($user);

            return $user;
        });

        $token = $user->createToken('mobile-' . $flow)->plainTextToken;

        return response()->json([
            'message' => 'OTP verification successful.',
            'flow' => $flow,
            'token_type' => 'Bearer',
            'access_token' => $token,
            'requires_pin_setup' => empty($user->transaction_pin),
            'user' => [
                'id' => $user->id,
                'name' => $user->full_name ?: $user->name,
                'email' => $user->email,
                'phone_number' => $user->phone_number,
                'kyc_status' => $user->kyc_status,
                'account_status' => $user->account_status,
            ],
        ]);
    }

    public function setPin(Request $request): JsonResponse
    {
        $data = $request->validate([
            'pin' => ['required', 'digits_between:4,6'],
            'current_pin' => ['nullable', 'digits_between:4,6'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $activeTokenName = (string) optional($user->currentAccessToken())->name;
        $isRecoverySession = str_contains($activeTokenName, 'mobile-recovery');

        $currentPin = (string) ($data['current_pin'] ?? '');
        if (! empty($user->transaction_pin) && ! $isRecoverySession) {
            if ($currentPin === '') {
                throw ValidationException::withMessages([
                    'current_pin' => 'Current PIN is required to update PIN.',
                ]);
            }

            if (! Hash::check($currentPin, (string) $user->transaction_pin)) {
                throw ValidationException::withMessages([
                    'current_pin' => 'Current PIN is incorrect.',
                ]);
            }
        }

        if (! empty($user->transaction_pin) && Hash::check((string) $data['pin'], (string) $user->transaction_pin)) {
            throw ValidationException::withMessages([
                'pin' => 'New PIN must be different from current PIN.',
            ]);
        }

        $user->transaction_pin = $data['pin'];
        $user->save();

        return response()->json([
            'message' => 'Transaction PIN updated successfully.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->full_name ?: $user->name,
                'email' => $user->email,
                'phone_number' => $user->phone_number,
                'kyc_status' => $user->kyc_status,
                'account_status' => $user->account_status,
                'last_login_at' => optional($user->last_login_at)?->toIso8601String(),
            ],
            'wallets' => $user->wallets()
                ->orderBy('currency')
                ->get(['id', 'currency', 'balance', 'locked_balance', 'is_active']),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'full_name' => ['required', 'string', 'min:3', 'max:120'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $fullName = trim((string) $data['full_name']);

        $user->forceFill([
            'full_name' => $fullName,
            'name' => $fullName,
        ])->save();

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => [
                'id' => $user->id,
                'name' => $user->full_name ?: $user->name,
                'email' => $user->email,
                'phone_number' => $user->phone_number,
                'kyc_status' => $user->kyc_status,
                'account_status' => $user->account_status,
                'last_login_at' => optional($user->last_login_at)?->toIso8601String(),
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    private function ensureDefaultWallets(User $user): void
    {
        $currencies = ['usd', 'usdt', 'sol'];

        foreach ($currencies as $currency) {
            Wallet::query()->firstOrCreate(
                [
                    'user_id' => $user->id,
                    'currency' => $currency,
                ],
                [
                    'balance' => 0,
                    'locked_balance' => 0,
                    'is_active' => true,
                ]
            );
        }
    }
}
