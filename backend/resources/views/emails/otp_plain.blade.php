{{ $appName }} - Email Verification OTP

We received a {{ strtolower($flowTitle) }} request for {{ $email }}.

Use this one time password to continue {{ $actionLabel }}:
{{ $otp }}

This OTP expires in {{ $expiresMinutes }} minutes.

If you did not request this code, ignore this email.
Support: {{ $supportEmail }}
