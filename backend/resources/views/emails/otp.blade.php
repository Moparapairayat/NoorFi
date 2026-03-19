<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <title>{{ $appName }} OTP</title>
</head>
<body style="margin:0;padding:0;background:#edf3ef;font-family:Arial,Helvetica,sans-serif;color:#10211b;">
<table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;background:#edf3ef;padding:22px 10px;">
    <tr>
        <td align="center">
            <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:580px;border-radius:20px;overflow:hidden;background:#ffffff;border:1px solid #dbe6e1;">
                <tr>
                    <td style="padding:0;">
                        <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;background:linear-gradient(135deg,#0f3429 0%,#1b5b44 56%,#2b8060 100%);">
                            <tr>
                                <td style="padding:24px 26px 22px 26px;">
                                    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                                        <tr>
                                            <td style="vertical-align:top;">
                                                <div style="display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(236,220,185,0.45);border-radius:999px;padding:6px 12px;color:#ecdcb9;font-size:11px;letter-spacing:0.6px;text-transform:uppercase;">
                                                    {{ $appName }} Secure Access
                                                </div>
                                                <h1 style="margin:14px 0 8px 0;color:#f4fbf7;font-size:26px;line-height:1.2;font-weight:700;">
                                                    Verify your email
                                                </h1>
                                                <p style="margin:0;color:rgba(244,251,247,0.9);font-size:14px;line-height:1.6;">
                                                    We received a {{ strtolower($flowTitle) }} request for:
                                                </p>
                                                <div style="margin-top:10px;">
                                                    <span style="display:inline-block;background:rgba(255,255,255,0.22);border:1px solid rgba(255,255,255,0.6);border-radius:10px;padding:7px 12px;font-size:13px;font-weight:700;letter-spacing:0.2px;">
                                                        <a href="mailto:{{ $email }}" style="color:#f8e7c2 !important;text-decoration:none !important;font-weight:700;">
                                                            {{ $email }}
                                                        </a>
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <tr>
                    <td style="padding:24px 26px 10px 26px;">
                        <p style="margin:0 0 14px 0;color:#355347;font-size:14px;line-height:1.65;">
                            Enter this one time password in the app to finish
                            <strong>{{ $actionLabel }}</strong>.
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style="padding:0 26px 0 26px;">
                        <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border-radius:16px;overflow:hidden;border:1px solid #b9d3c6;background:#f7fbf9;">
                            <tr>
                                <td style="padding:16px 16px 6px 16px;text-align:center;">
                                    <div style="display:inline-block;padding:5px 10px;border-radius:999px;background:#e4f0ea;color:#507164;font-size:11px;letter-spacing:0.6px;text-transform:uppercase;">
                                        One Time Password
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:4px 16px 18px 16px;text-align:center;">
                                    <div style="font-size:36px;line-height:1.05;letter-spacing:10px;font-weight:700;color:#10392d;">
                                        {{ $otp }}
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:0 16px 16px 16px;text-align:center;">
                                    <div style="display:inline-block;background:#0f3d2f;color:#e8f3ee;border-radius:10px;padding:7px 12px;font-size:12px;">
                                        Expires in {{ $expiresMinutes }} minutes
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <tr>
                    <td style="padding:18px 26px 12px 26px;">
                        <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                            <tr>
                                <td style="padding:0 0 8px 0;color:#4d6d60;font-size:13px;line-height:1.6;">
                                    If you did not request this OTP, ignore this email and keep your account secure.
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:0;color:#4d6d60;font-size:13px;line-height:1.6;">
                                    For help, contact
                                    <a href="mailto:{{ $supportEmail }}" style="color:#1c6a50;text-decoration:none;font-weight:700;">{{ $supportEmail }}</a>.
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <tr>
                    <td style="padding:0 26px 24px 26px;">
                        <div style="height:1px;background:#e2ece8;"></div>
                        <p style="margin:12px 0 0 0;color:#739085;font-size:12px;line-height:1.6;">
                            &copy; {{ now()->year }} {{ $appName }}. All rights reserved.
                        </p>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
