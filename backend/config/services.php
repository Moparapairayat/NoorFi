<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'strowallet' => [
        'public_key' => env('STROWALLET_PUBLIC_KEY'),
        'secret_key' => env('STROWALLET_SECRET_KEY'),
        'mode' => env('STROWALLET_MODE'),
        'card_type' => env('STROWALLET_CARD_TYPE', 'mastercard'),
        'base_url' => env('STROWALLET_BASE_URL', 'https://strowallet.com/api/bitvcard'),
        'webhook_url' => env('STROWALLET_WEBHOOK_URL'),
        'card_limit_per_user' => (int) env('STROWALLET_CARD_LIMIT_PER_USER', 3),
        'card_details_html' => env('STROWALLET_CARD_DETAILS_HTML', 'This card is property of NoorFi. Misuse is prohibited.'),
        'background_image' => env('STROWALLET_BACKGROUND_IMAGE'),
        'timeout_seconds' => (int) env('STROWALLET_TIMEOUT_SECONDS', 25),
        'create_customer_endpoint' => env('STROWALLET_CREATE_CUSTOMER_ENDPOINT', 'https://strowallet.com/api/bitvcard/create-user'),
        'create_customer_method' => env('STROWALLET_CREATE_CUSTOMER_METHOD', 'POST'),
        'create_customer_endpoint_fallback' => env('STROWALLET_CREATE_CUSTOMER_ENDPOINT_FALLBACK'),
        'create_customer_endpoint_fallback_method' => env('STROWALLET_CREATE_CUSTOMER_ENDPOINT_FALLBACK_METHOD', 'GET'),
        'get_customer_endpoint' => env('STROWALLET_GET_CUSTOMER_ENDPOINT', 'https://strowallet.com/api/bitvcard/getcardholder'),
        'create_card_endpoint' => env('STROWALLET_CREATE_CARD_ENDPOINT', 'https://strowallet.com/api/bitvcard/create-card'),
        'card_details_endpoint' => env('STROWALLET_CARD_DETAILS_ENDPOINT', 'https://strowallet.com/api/bitvcard/fetch-card-detail'),
        'card_transactions_endpoint' => env('STROWALLET_CARD_TRANSACTIONS_ENDPOINT', 'https://strowallet.com/api/bitvcard/card-transactions'),
        'freeze_unfreeze_endpoint' => env('STROWALLET_FREEZE_UNFREEZE_ENDPOINT', 'https://strowallet.com/api/bitvcard/action/status'),
        'upgrade_card_limit_endpoint' => env('STROWALLET_UPGRADE_CARD_LIMIT_ENDPOINT', 'https://strowallet.com/api/bitvcard/upgradecardlimit'),
        'fund_card_endpoint' => env('STROWALLET_FUND_CARD_ENDPOINT', 'https://strowallet.com/api/bitvcard/fund-card'),
        'withdraw_from_card_endpoint' => env('STROWALLET_WITHDRAW_FROM_CARD_ENDPOINT', 'https://strowallet.com/api/bitvcard/card_withdraw'),
    ],

    'card_providers' => [
        'virtual' => env('VIRTUAL_CARD_PROVIDER', 'strowallet'),
        'physical' => env('PHYSICAL_CARD_PROVIDER', 'coming_soon'),
    ],

    'didit' => [
        'api_key' => env('DIDIT_API_KEY'),
        'webhook_secret' => env('DIDIT_WEBHOOK_SECRET'),
        'workflow_id' => env('DIDIT_WORKFLOW_ID'),
        'base_url' => env('DIDIT_BASE_URL', 'https://verification.didit.me'),
        'callback_url' => env('DIDIT_CALLBACK_URL'),
        'callback_method' => env('DIDIT_CALLBACK_METHOD', 'initiator'),
        'language' => env('DIDIT_LANGUAGE', 'en'),
        'send_notification_emails' => filter_var(env('DIDIT_SEND_NOTIFICATION_EMAILS', false), FILTER_VALIDATE_BOOLEAN),
        'timeout_seconds' => (int) env('DIDIT_TIMEOUT_SECONDS', 25),
    ],

    'heleket' => [
        'merchant_id' => env('HELEKET_MERCHANT_ID'),
        'payment_api_key' => env('HELEKET_PAYMENT_API_KEY'),
        'payout_api_key' => env('HELEKET_PAYOUT_API_KEY'),
        'base_url' => env('HELEKET_BASE_URL', 'https://api.heleket.com'),
        'callback_url' => env('HELEKET_CALLBACK_URL'),
        'payout_callback_url' => env('HELEKET_PAYOUT_CALLBACK_URL'),
        'success_url' => env('HELEKET_SUCCESS_URL'),
        'return_url' => env('HELEKET_RETURN_URL'),
        'timeout_seconds' => (int) env('HELEKET_TIMEOUT_SECONDS', 25),
    ],

    'binance_pay' => [
        'api_key' => env('BINANCE_PAY_API_KEY'),
        'api_secret' => env('BINANCE_PAY_API_SECRET'),
        'merchant_id' => env('BINANCE_PAY_MERCHANT_ID'),
        'base_url' => env('BINANCE_PAY_BASE_URL', 'https://bpay.binanceapi.com'),
        'return_url' => env('BINANCE_PAY_RETURN_URL'),
        'cancel_url' => env('BINANCE_PAY_CANCEL_URL'),
        'webhook_url' => env('BINANCE_PAY_WEBHOOK_URL'),
        'timeout_seconds' => (int) env('BINANCE_PAY_TIMEOUT_SECONDS', 25),
    ],

];

