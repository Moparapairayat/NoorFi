<?php

namespace App\Filament\Pages;

use App\Models\SystemSetting;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Components\Actions;
use Filament\Schemas\Components\EmbeddedSchema;
use Filament\Schemas\Components\Form;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Enums\Alignment;
use Filament\Support\Icons\Heroicon;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Support\Facades\DB;
use UnitEnum;

class HeleketApiPage extends Page
{
    protected static ?string $title = 'Setup Heleket API';

    protected static ?string $slug = 'heleket-api';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedBuildingLibrary;

    protected static ?string $navigationLabel = 'Heleket API';

    protected static string|UnitEnum|null $navigationGroup = 'Infrastructure';

    protected static ?int $navigationSort = 9;

    /**
     * @var array<string, mixed>|null
     */
    public ?array $data = [];

    public static function canAccess(): bool
    {
        $user = auth()->user();

        return $user instanceof User && $user->hasPanelRole(User::ADMIN_ROLE_SUPER_ADMIN);
    }

    public function mount(): void
    {
        SystemSetting::syncDefaults();
        $this->form->fill($this->getFormState());
    }

    public function getTitle(): string|Htmlable
    {
        return 'Setup Heleket API';
    }

    public function getSubheading(): ?string
    {
        return 'Configure deposit + payout credentials, webhook callbacks, and checkout return URLs.';
    }

    public function defaultForm(Schema $schema): Schema
    {
        return $schema->statePath('data');
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Heleket API')
                    ->description('Combined payment and payout setup')
                    ->schema([
                        TextInput::make('name')
                            ->label('Name')
                            ->default('Heleket API')
                            ->disabled()
                            ->dehydrated(false)
                            ->columnSpanFull(),

                        Grid::make(3)
                            ->schema([
                                TextInput::make('merchant_id')
                                    ->label('Merchant ID')
                                    ->required()
                                    ->maxLength(191),
                                TextInput::make('payment_api_key')
                                    ->label('Payment API Key')
                                    ->password()
                                    ->revealable()
                                    ->required()
                                    ->prefixIcon('heroicon-o-key')
                                    ->maxLength(255),
                                TextInput::make('payout_api_key')
                                    ->label('Payout API Key')
                                    ->password()
                                    ->revealable()
                                    ->required()
                                    ->prefixIcon('heroicon-o-key')
                                    ->maxLength(255),
                            ]),

                        Grid::make(2)
                            ->schema([
                                TextInput::make('base_url')
                                    ->label('Base URL')
                                    ->url()
                                    ->required()
                                    ->prefixIcon('heroicon-o-link')
                                    ->maxLength(255),
                                TextInput::make('timeout_seconds')
                                    ->label('Timeout (seconds)')
                                    ->numeric()
                                    ->minValue(5)
                                    ->maxValue(120)
                                    ->required(),
                            ]),

                        Grid::make(2)
                            ->schema([
                                TextInput::make('callback_url')
                                    ->label('Deposit Callback URL')
                                    ->url()
                                    ->copyable()
                                    ->prefixIcon('heroicon-o-link')
                                    ->maxLength(2048),
                                TextInput::make('payout_callback_url')
                                    ->label('Payout Callback URL')
                                    ->url()
                                    ->copyable()
                                    ->prefixIcon('heroicon-o-link')
                                    ->maxLength(2048),
                            ]),

                        Grid::make(2)
                            ->schema([
                                TextInput::make('success_url')
                                    ->label('Success URL')
                                    ->url()
                                    ->maxLength(2048),
                                TextInput::make('return_url')
                                    ->label('Return URL')
                                    ->url()
                                    ->maxLength(2048),
                            ]),

                        Grid::make(2)
                            ->schema([
                                TextInput::make('deposit_webhook_endpoint')
                                    ->label('Deposit Webhook Endpoint')
                                    ->disabled()
                                    ->dehydrated(false)
                                    ->copyable()
                                    ->prefixIcon('heroicon-o-link')
                                    ->maxLength(2048),
                                TextInput::make('payout_webhook_endpoint')
                                    ->label('Payout Webhook Endpoint')
                                    ->disabled()
                                    ->dehydrated(false)
                                    ->copyable()
                                    ->prefixIcon('heroicon-o-link')
                                    ->maxLength(2048),
                            ]),
                    ]),
            ]);
    }

    public function content(Schema $schema): Schema
    {
        return $schema
            ->components([
                Form::make([
                    EmbeddedSchema::make('form'),
                ])
                    ->id('heleket-api-form')
                    ->livewireSubmitHandler('save')
                    ->footer([
                        Actions::make($this->getFormActions())
                            ->alignment(Alignment::Start),
                    ]),
            ]);
    }

    /**
     * @return array<Action>
     */
    protected function getFormActions(): array
    {
        return [
            Action::make('save')
                ->label('Save Setup')
                ->submit('save')
                ->icon('heroicon-o-check-circle')
                ->keyBindings(['mod+s']),
            Action::make('reload')
                ->label('Reload')
                ->color('gray')
                ->icon('heroicon-o-arrow-path')
                ->action(function (): void {
                    $this->form->fill($this->getFormState());
                }),
        ];
    }

    public function save(): void
    {
        /** @var array<string, mixed> $state */
        $state = $this->form->getState();

        $timeout = (int) ($state['timeout_seconds'] ?? 25);
        $timeout = max(min($timeout, 120), 5);

        $depositWebhookEndpoint = $this->depositWebhookEndpoint();
        $payoutWebhookEndpoint = $this->payoutWebhookEndpoint();

        $callbackUrl = trim((string) ($state['callback_url'] ?? ''));
        if ($callbackUrl === '') {
            $callbackUrl = $depositWebhookEndpoint;
        }

        $payoutCallbackUrl = trim((string) ($state['payout_callback_url'] ?? ''));
        if ($payoutCallbackUrl === '') {
            $payoutCallbackUrl = $payoutWebhookEndpoint;
        }

        DB::transaction(function () use ($state, $timeout, $callbackUrl, $payoutCallbackUrl): void {
            $this->put('services.heleket.merchant_id', trim((string) ($state['merchant_id'] ?? '')));
            $this->put('services.heleket.payment_api_key', trim((string) ($state['payment_api_key'] ?? '')));
            $this->put('services.heleket.payout_api_key', trim((string) ($state['payout_api_key'] ?? '')));
            $this->put('services.heleket.base_url', $this->normalizeBaseUrl((string) ($state['base_url'] ?? '')));
            $this->put('services.heleket.callback_url', $callbackUrl);
            $this->put('services.heleket.payout_callback_url', $payoutCallbackUrl);
            $this->put('services.heleket.success_url', trim((string) ($state['success_url'] ?? '')));
            $this->put('services.heleket.return_url', trim((string) ($state['return_url'] ?? '')));
            $this->put('services.heleket.timeout_seconds', $timeout);
        });

        $this->form->fill($this->getFormState());

        Notification::make()
            ->success()
            ->title('Heleket setup updated')
            ->body('Payment and payout API setup values were saved successfully.')
            ->send();
    }

    /**
     * @return array<string, mixed>
     */
    private function getFormState(): array
    {
        $depositWebhookEndpoint = $this->depositWebhookEndpoint();
        $payoutWebhookEndpoint = $this->payoutWebhookEndpoint();

        return [
            'name' => 'Heleket API',
            'merchant_id' => (string) config('services.heleket.merchant_id', ''),
            'payment_api_key' => (string) config('services.heleket.payment_api_key', ''),
            'payout_api_key' => (string) config('services.heleket.payout_api_key', ''),
            'base_url' => (string) config('services.heleket.base_url', 'https://api.heleket.com'),
            'callback_url' => (string) config('services.heleket.callback_url', $depositWebhookEndpoint),
            'payout_callback_url' => (string) config('services.heleket.payout_callback_url', $payoutWebhookEndpoint),
            'success_url' => (string) config('services.heleket.success_url', ''),
            'return_url' => (string) config('services.heleket.return_url', ''),
            'timeout_seconds' => (int) config('services.heleket.timeout_seconds', 25),
            'deposit_webhook_endpoint' => $depositWebhookEndpoint,
            'payout_webhook_endpoint' => $payoutWebhookEndpoint,
        ];
    }

    private function depositWebhookEndpoint(): string
    {
        return rtrim((string) config('app.url', ''), '/') . '/api/deposits/heleket/webhook';
    }

    private function payoutWebhookEndpoint(): string
    {
        return rtrim((string) config('app.url', ''), '/') . '/api/withdrawals/heleket/webhook';
    }

    private function normalizeBaseUrl(string $baseUrl): string
    {
        $normalized = rtrim(trim($baseUrl), '/');

        return $normalized !== '' ? $normalized : 'https://api.heleket.com';
    }

    private function put(string $key, mixed $value): void
    {
        $record = SystemSetting::query()->where('key', $key)->first();
        if (! $record instanceof SystemSetting) {
            return;
        }

        $record->forceFill([
            'value' => $value,
        ])->save();
    }
}

