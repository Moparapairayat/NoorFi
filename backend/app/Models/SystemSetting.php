<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;

class SystemSetting extends Model
{
    use HasFactory;

    public const CONFIG_CACHE_KEY = 'system_settings:config_map:v1';

    /**
     * Prevent accidental mutation of definition fields from admin/UI writes.
     */
    protected static bool $allowDefinitionMutation = false;

    protected $fillable = [
        'module',
        'key',
        'label',
        'description',
        'type',
        'is_secret',
        'value',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'is_secret' => 'boolean',
            'value' => 'encrypted',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (self $setting): void {
            if ($setting->exists && ! self::$allowDefinitionMutation) {
                foreach (['module', 'key', 'label', 'description', 'type', 'is_secret'] as $field) {
                    $setting->{$field} = $setting->getOriginal($field);
                }
            }

            $setting->value = self::normalizeForStorage($setting->value, $setting->type);

            if (auth()->check()) {
                $setting->updated_by = (int) auth()->id();
            }
        });

        static::saved(fn (): bool => self::flushConfigCache());
        static::deleted(fn (): bool => self::flushConfigCache());
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function toRuntimeValue(): mixed
    {
        return self::castToRuntime($this->value, $this->type);
    }

    public function valuePreview(): string
    {
        if ($this->is_secret) {
            return $this->value === null ? '-' : '********';
        }

        $value = $this->toRuntimeValue();
        if ($value === null) {
            return '-';
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_array($value)) {
            $encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if (! is_string($encoded)) {
                return '[json]';
            }

            return mb_strlen($encoded) > 80 ? mb_substr($encoded, 0, 80) . '...' : $encoded;
        }

        $string = (string) $value;

        return mb_strlen($string) > 80 ? mb_substr($string, 0, 80) . '...' : $string;
    }

    /**
     * @return array<string, mixed>
     */
    public static function cachedConfigMap(): array
    {
        return Cache::rememberForever(self::CONFIG_CACHE_KEY, function (): array {
            $map = [];

            $settings = self::query()
                ->whereNotNull('value')
                ->get(['key', 'type', 'value']);

            foreach ($settings as $setting) {
                $runtime = self::castToRuntime($setting->value, $setting->type);
                if ($runtime === null) {
                    continue;
                }

                $map[$setting->key] = $runtime;
            }

            return $map;
        });
    }

    public static function flushConfigCache(): bool
    {
        return Cache::forget(self::CONFIG_CACHE_KEY);
    }

    /**
     * @return array<int, array{
     *     module: string,
     *     key: string,
     *     label: string,
     *     description: string,
     *     type: string,
     *     is_secret: bool,
     *     default_value: mixed
     * }>
     */
    public static function defaultDefinitions(): array
    {
        return [
            self::definition('app', 'app.name', 'App Name', 'Project display name.', 'string', false, config('app.name')),
            self::definition('app', 'app.url', 'App URL', 'Backend base URL used in callbacks.', 'url', false, config('app.url')),
            self::definition('mail', 'mail.default', 'Mail Provider', 'Default mail transport driver.', 'string', false, config('mail.default')),
            self::definition('mail', 'mail.from.address', 'Mail From Address', 'Sender email used for OTP and system mail.', 'string', false, config('mail.from.address')),
            self::definition('mail', 'mail.from.name', 'Mail From Name', 'Sender name used for OTP and system mail.', 'string', false, config('mail.from.name')),
            self::definition('mail', 'services.resend.key', 'Resend API Key', 'Resend provider API key.', 'string', true, config('services.resend.key')),
            self::definition('mail', 'mail.mailers.smtp.host', 'SMTP Host', 'SMTP server host.', 'string', false, config('mail.mailers.smtp.host')),
            self::definition('mail', 'mail.mailers.smtp.port', 'SMTP Port', 'SMTP server port.', 'int', false, config('mail.mailers.smtp.port')),
            self::definition('mail', 'mail.mailers.smtp.username', 'SMTP Username', 'SMTP authentication username.', 'string', false, config('mail.mailers.smtp.username')),
            self::definition('mail', 'mail.mailers.smtp.password', 'SMTP Password', 'SMTP authentication password.', 'string', true, config('mail.mailers.smtp.password')),
            self::definition('mail', 'mail.mailers.smtp.scheme', 'SMTP Scheme', 'SMTP encryption scheme: tls/ssl.', 'string', false, config('mail.mailers.smtp.scheme')),

            self::definition('providers', 'services.card_providers.virtual', 'Virtual Card Provider', 'Primary virtual card provider key.', 'string', false, config('services.card_providers.virtual')),
            self::definition('providers', 'services.card_providers.physical', 'Physical Card Provider', 'Primary physical card provider key.', 'string', false, config('services.card_providers.physical')),

            self::definition('strowallet', 'services.strowallet.public_key', 'Strowallet Public Key', 'Strowallet public key.', 'string', true, config('services.strowallet.public_key')),
            self::definition('strowallet', 'services.strowallet.secret_key', 'Strowallet Secret Key', 'Strowallet secret key.', 'string', true, config('services.strowallet.secret_key')),
            self::definition('strowallet', 'services.strowallet.mode', 'Strowallet Mode', 'Provider mode (sandbox/live).', 'string', false, config('services.strowallet.mode')),
            self::definition('strowallet', 'services.strowallet.card_type', 'Strowallet Card Type', 'Card scheme type.', 'string', false, config('services.strowallet.card_type')),
            self::definition('strowallet', 'services.strowallet.base_url', 'Strowallet Base URL', 'Primary Strowallet API base URL.', 'url', false, config('services.strowallet.base_url')),
            self::definition('strowallet', 'services.strowallet.webhook_url', 'Strowallet Webhook URL', 'Webhook endpoint URL used for card event callbacks.', 'url', false, config('services.strowallet.webhook_url')),
            self::definition('strowallet', 'services.strowallet.card_limit_per_user', 'Card Limit Per User', 'Maximum active virtual cards per user.', 'int', false, config('services.strowallet.card_limit_per_user')),
            self::definition('strowallet', 'services.strowallet.card_details_html', 'Card Details Text', 'Provider card details/disclaimer rich text.', 'string', false, config('services.strowallet.card_details_html')),
            self::definition('strowallet', 'services.strowallet.background_image', 'Card Background Image', 'Stored image path/url for card template background.', 'string', false, config('services.strowallet.background_image')),
            self::definition('strowallet', 'services.strowallet.timeout_seconds', 'Strowallet Timeout', 'HTTP timeout in seconds.', 'int', false, config('services.strowallet.timeout_seconds')),
            self::definition('strowallet', 'services.strowallet.create_customer_endpoint', 'Create Customer Endpoint', 'Create customer endpoint URL.', 'url', false, config('services.strowallet.create_customer_endpoint')),
            self::definition('strowallet', 'services.strowallet.create_customer_method', 'Create Customer Method', 'HTTP method for create customer endpoint.', 'string', false, config('services.strowallet.create_customer_method')),
            self::definition('strowallet', 'services.strowallet.create_customer_endpoint_fallback', 'Create Customer Fallback Endpoint', 'Fallback endpoint URL for customer creation.', 'url', false, config('services.strowallet.create_customer_endpoint_fallback')),
            self::definition('strowallet', 'services.strowallet.create_customer_endpoint_fallback_method', 'Create Customer Fallback Method', 'HTTP method for fallback endpoint.', 'string', false, config('services.strowallet.create_customer_endpoint_fallback_method')),
            self::definition('strowallet', 'services.strowallet.get_customer_endpoint', 'Get Customer Endpoint', 'Fetch customer endpoint URL.', 'url', false, config('services.strowallet.get_customer_endpoint')),
            self::definition('strowallet', 'services.strowallet.create_card_endpoint', 'Create Card Endpoint', 'Create card endpoint URL.', 'url', false, config('services.strowallet.create_card_endpoint')),
            self::definition('strowallet', 'services.strowallet.card_details_endpoint', 'Card Details Endpoint', 'Fetch card details endpoint URL.', 'url', false, config('services.strowallet.card_details_endpoint')),
            self::definition('strowallet', 'services.strowallet.card_transactions_endpoint', 'Card Transactions Endpoint', 'Fetch card transactions endpoint URL.', 'url', false, config('services.strowallet.card_transactions_endpoint')),
            self::definition('strowallet', 'services.strowallet.freeze_unfreeze_endpoint', 'Freeze/Unfreeze Endpoint', 'Card freeze/unfreeze endpoint URL.', 'url', false, config('services.strowallet.freeze_unfreeze_endpoint')),
            self::definition('strowallet', 'services.strowallet.upgrade_card_limit_endpoint', 'Upgrade Limit Endpoint', 'Card limit upgrade endpoint URL.', 'url', false, config('services.strowallet.upgrade_card_limit_endpoint')),
            self::definition('strowallet', 'services.strowallet.fund_card_endpoint', 'Fund Card Endpoint', 'Add fund into virtual card endpoint URL.', 'url', false, config('services.strowallet.fund_card_endpoint')),
            self::definition('strowallet', 'services.strowallet.withdraw_from_card_endpoint', 'Withdraw From Card Endpoint', 'Withdraw amount from virtual card endpoint URL.', 'url', false, config('services.strowallet.withdraw_from_card_endpoint')),

            self::definition('didit', 'services.didit.api_key', 'Didit API Key', 'Didit API key.', 'string', true, config('services.didit.api_key')),
            self::definition('didit', 'services.didit.webhook_secret', 'Didit Webhook Secret', 'Didit webhook signature secret.', 'string', true, config('services.didit.webhook_secret')),
            self::definition('didit', 'services.didit.workflow_id', 'Didit Workflow ID', 'Didit KYC workflow UUID.', 'string', false, config('services.didit.workflow_id')),
            self::definition('didit', 'services.didit.base_url', 'Didit Base URL', 'Didit API base URL.', 'url', false, config('services.didit.base_url')),
            self::definition('didit', 'services.didit.callback_url', 'Didit Callback URL', 'Didit callback URL.', 'url', false, config('services.didit.callback_url')),
            self::definition('didit', 'services.didit.callback_method', 'Didit Callback Method', 'Didit callback method.', 'string', false, config('services.didit.callback_method')),
            self::definition('didit', 'services.didit.language', 'Didit Language', 'Didit notification language.', 'string', false, config('services.didit.language')),
            self::definition('didit', 'services.didit.send_notification_emails', 'Didit Notify Emails', 'true/false to send Didit notification emails.', 'bool', false, config('services.didit.send_notification_emails')),
            self::definition('didit', 'services.didit.timeout_seconds', 'Didit Timeout', 'HTTP timeout in seconds.', 'int', false, config('services.didit.timeout_seconds')),

            self::definition('heleket', 'services.heleket.merchant_id', 'Heleket Merchant ID', 'Heleket merchant identifier.', 'string', false, config('services.heleket.merchant_id')),
            self::definition('heleket', 'services.heleket.payment_api_key', 'Heleket Payment API Key', 'Heleket payment key.', 'string', true, config('services.heleket.payment_api_key')),
            self::definition('heleket', 'services.heleket.payout_api_key', 'Heleket Payout API Key', 'Heleket payout key.', 'string', true, config('services.heleket.payout_api_key')),
            self::definition('heleket', 'services.heleket.base_url', 'Heleket Base URL', 'Heleket API base URL.', 'url', false, config('services.heleket.base_url')),
            self::definition('heleket', 'services.heleket.callback_url', 'Heleket Callback URL', 'Deposit callback URL.', 'url', false, config('services.heleket.callback_url')),
            self::definition('heleket', 'services.heleket.payout_callback_url', 'Heleket Payout Callback URL', 'Payout callback URL.', 'url', false, config('services.heleket.payout_callback_url')),
            self::definition('heleket', 'services.heleket.success_url', 'Heleket Success URL', 'Checkout success URL.', 'url', false, config('services.heleket.success_url')),
            self::definition('heleket', 'services.heleket.return_url', 'Heleket Return URL', 'Checkout return URL.', 'url', false, config('services.heleket.return_url')),
            self::definition('heleket', 'services.heleket.timeout_seconds', 'Heleket Timeout', 'HTTP timeout in seconds.', 'int', false, config('services.heleket.timeout_seconds')),

            self::definition('binance_pay', 'services.binance_pay.api_key', 'Binance Pay API Key', 'Binance Pay API key.', 'string', true, config('services.binance_pay.api_key')),
            self::definition('binance_pay', 'services.binance_pay.api_secret', 'Binance Pay API Secret', 'Binance Pay API secret.', 'string', true, config('services.binance_pay.api_secret')),
            self::definition('binance_pay', 'services.binance_pay.merchant_id', 'Binance Pay Merchant ID', 'Binance Pay merchant id.', 'string', false, config('services.binance_pay.merchant_id')),
            self::definition('binance_pay', 'services.binance_pay.base_url', 'Binance Pay Base URL', 'Binance Pay API base URL.', 'url', false, config('services.binance_pay.base_url')),
            self::definition('binance_pay', 'services.binance_pay.return_url', 'Binance Pay Return URL', 'Payment return URL.', 'url', false, config('services.binance_pay.return_url')),
            self::definition('binance_pay', 'services.binance_pay.cancel_url', 'Binance Pay Cancel URL', 'Payment cancel URL.', 'url', false, config('services.binance_pay.cancel_url')),
            self::definition('binance_pay', 'services.binance_pay.webhook_url', 'Binance Pay Webhook URL', 'Webhook callback URL.', 'url', false, config('services.binance_pay.webhook_url')),
            self::definition('binance_pay', 'services.binance_pay.timeout_seconds', 'Binance Pay Timeout', 'HTTP timeout in seconds.', 'int', false, config('services.binance_pay.timeout_seconds')),
        ];
    }

    public static function syncDefaults(): void
    {
        self::withDefinitionMutation(function (): void {
            foreach (self::defaultDefinitions() as $definition) {
                $record = self::query()->firstOrNew([
                    'key' => $definition['key'],
                ]);

                $record->module = $definition['module'];
                $record->label = $definition['label'];
                $record->description = $definition['description'];
                $record->type = $definition['type'];
                $record->is_secret = $definition['is_secret'];

                if (! $record->exists || $record->value === null) {
                    $record->value = self::normalizeForStorage(
                        $definition['default_value'],
                        $definition['type']
                    );
                }

                $record->save();
            }
        });
    }

    /**
     * @return array<string, string>
     */
    public static function moduleOptions(): array
    {
        $options = [];

        foreach (self::defaultDefinitions() as $definition) {
            $module = $definition['module'];
            $options[$module] = strtoupper(str_replace('_', ' ', $module));
        }

        return $options;
    }

    public static function moduleColor(string $module): string
    {
        return match (strtolower(trim($module))) {
            'strowallet' => 'info',
            'didit' => 'warning',
            'heleket' => 'success',
            'binance_pay' => 'amber',
            'mail' => 'primary',
            'providers' => 'gray',
            'app' => 'slate',
            default => 'gray',
        };
    }

    /**
     * @return array{
     *     module: string,
     *     key: string,
     *     label: string,
     *     description: string,
     *     type: string,
     *     is_secret: bool,
     *     default_value: mixed
     * }|null
     */
    public static function definitionForKey(string $key): ?array
    {
        $needle = trim($key);
        if ($needle === '') {
            return null;
        }

        foreach (self::defaultDefinitions() as $definition) {
            if ($definition['key'] === $needle) {
                return $definition;
            }
        }

        return null;
    }

    /**
     * @return array<string, string>
     */
    public static function typeOptions(): array
    {
        return [
            'string' => 'String',
            'int' => 'Integer',
            'float' => 'Float',
            'bool' => 'Boolean',
            'json' => 'JSON',
            'url' => 'URL',
        ];
    }

    /**
     * @return array{
     *     module: string,
     *     key: string,
     *     label: string,
     *     description: string,
     *     type: string,
     *     is_secret: bool,
     *     default_value: mixed
     * }
     */
    private static function definition(
        string $module,
        string $key,
        string $label,
        string $description,
        string $type,
        bool $isSecret,
        mixed $defaultValue
    ): array {
        return [
            'module' => $module,
            'key' => $key,
            'label' => $label,
            'description' => $description,
            'type' => $type,
            'is_secret' => $isSecret,
            'default_value' => $defaultValue,
        ];
    }

    private static function normalizeForStorage(mixed $value, string $type): ?string
    {
        if ($value === null) {
            return null;
        }

        if (is_string($value)) {
            $value = trim($value);
            if ($value === '') {
                return null;
            }
        }

        return match ($type) {
            'bool' => self::normalizeBoolStorage($value),
            'int' => (string) (int) $value,
            'float' => (string) (float) $value,
            'json' => self::normalizeJsonStorage($value),
            default => (string) $value,
        };
    }

    private static function normalizeBoolStorage(mixed $value): ?string
    {
        $bool = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if (! is_bool($bool)) {
            return null;
        }

        return $bool ? 'true' : 'false';
    }

    private static function normalizeJsonStorage(mixed $value): ?string
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $encoded = json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

                return is_string($encoded) ? $encoded : null;
            }

            return null;
        }

        if (is_array($value)) {
            $encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            return is_string($encoded) ? $encoded : null;
        }

        return null;
    }

    private static function castToRuntime(mixed $value, string $type): mixed
    {
        if ($value === null) {
            return null;
        }

        $raw = is_string($value) ? trim($value) : $value;
        if ($raw === '') {
            return null;
        }

        return match ($type) {
            'bool' => filter_var($raw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE),
            'int' => is_numeric($raw) ? (int) $raw : null,
            'float' => is_numeric($raw) ? (float) $raw : null,
            'json' => self::decodeJsonRuntime((string) $raw),
            default => (string) $raw,
        };
    }

    private static function decodeJsonRuntime(string $value): mixed
    {
        $decoded = json_decode($value, true);

        return json_last_error() === JSON_ERROR_NONE
            ? $decoded
            : null;
    }

    private static function withDefinitionMutation(callable $callback): mixed
    {
        $previous = self::$allowDefinitionMutation;
        self::$allowDefinitionMutation = true;

        try {
            return $callback();
        } finally {
            self::$allowDefinitionMutation = $previous;
        }
    }
}

