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

class BinancePayApiPage extends Page
{
    protected static ?string $title = 'Setup Binance Pay API';

    protected static ?string $slug = 'binance-pay-api';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedBolt;

    protected static ?string $navigationLabel = 'Binance Pay API';

    protected static string|UnitEnum|null $navigationGroup = 'Infrastructure';

    protected static ?int $navigationSort = 8;

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
        return 'Setup Binance Pay API';
    }

    public function getSubheading(): ?string
    {
        return 'Configure Binance Pay credentials and callback URLs for instant deposit checkout.';
    }

    public function defaultForm(Schema $schema): Schema
    {
        return $schema->statePath('data');
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Binance Pay API')
                    ->description('Payment provider setup')
                    ->schema([
                        TextInput::make('name')
                            ->label('Name')
                            ->default('Binance Pay API')
                            ->disabled()
                            ->dehydrated(false)
                            ->columnSpanFull(),

                        Grid::make(3)
                            ->schema([
                                TextInput::make('api_key')
                                    ->label('API Key')
                                    ->password()
                                    ->revealable()
                                    ->required()
                                    ->prefixIcon('heroicon-o-key')
                                    ->maxLength(255),
                                TextInput::make('api_secret')
                                    ->label('API Secret')
                                    ->password()
                                    ->revealable()
                                    ->required()
                                    ->prefixIcon('heroicon-o-key')
                                    ->maxLength(255),
                                TextInput::make('merchant_id')
                                    ->label('Merchant ID')
                                    ->required()
                                    ->maxLength(191),
                            ]),

                        Grid::make(3)
                            ->schema([
                                TextInput::make('base_url')
                                    ->label('Base URL')
                                    ->url()
                                    ->required()
                                    ->prefixIcon('heroicon-o-link')
                                    ->maxLength(255),
                                TextInput::make('return_url')
                                    ->label('Return URL')
                                    ->url()
                                    ->maxLength(2048),
                                TextInput::make('cancel_url')
                                    ->label('Cancel URL')
                                    ->url()
                                    ->maxLength(2048),
                            ]),

                        Grid::make(2)
                            ->schema([
                                TextInput::make('webhook_url')
                                    ->label('Webhook URL')
                                    ->url()
                                    ->copyable()
                                    ->prefixIcon('heroicon-o-link')
                                    ->maxLength(2048),
                                TextInput::make('timeout_seconds')
                                    ->label('Timeout (seconds)')
                                    ->numeric()
                                    ->minValue(5)
                                    ->maxValue(120)
                                    ->required(),
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
                    ->id('binance-pay-api-form')
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

        DB::transaction(function () use ($state, $timeout): void {
            $this->put('services.binance_pay.api_key', trim((string) ($state['api_key'] ?? '')));
            $this->put('services.binance_pay.api_secret', trim((string) ($state['api_secret'] ?? '')));
            $this->put('services.binance_pay.merchant_id', trim((string) ($state['merchant_id'] ?? '')));
            $this->put('services.binance_pay.base_url', $this->normalizeBaseUrl((string) ($state['base_url'] ?? '')));
            $this->put('services.binance_pay.return_url', trim((string) ($state['return_url'] ?? '')));
            $this->put('services.binance_pay.cancel_url', trim((string) ($state['cancel_url'] ?? '')));
            $this->put('services.binance_pay.webhook_url', trim((string) ($state['webhook_url'] ?? '')));
            $this->put('services.binance_pay.timeout_seconds', $timeout);
        });

        $this->form->fill($this->getFormState());

        Notification::make()
            ->success()
            ->title('Binance Pay setup updated')
            ->body('Payment API setup values were saved successfully.')
            ->send();
    }

    /**
     * @return array<string, mixed>
     */
    private function getFormState(): array
    {
        return [
            'name' => 'Binance Pay API',
            'api_key' => (string) config('services.binance_pay.api_key', ''),
            'api_secret' => (string) config('services.binance_pay.api_secret', ''),
            'merchant_id' => (string) config('services.binance_pay.merchant_id', ''),
            'base_url' => (string) config('services.binance_pay.base_url', 'https://bpay.binanceapi.com'),
            'return_url' => (string) config('services.binance_pay.return_url', ''),
            'cancel_url' => (string) config('services.binance_pay.cancel_url', ''),
            'webhook_url' => (string) config('services.binance_pay.webhook_url', ''),
            'timeout_seconds' => (int) config('services.binance_pay.timeout_seconds', 25),
        ];
    }

    private function normalizeBaseUrl(string $baseUrl): string
    {
        $normalized = rtrim(trim($baseUrl), '/');

        return $normalized !== '' ? $normalized : 'https://bpay.binanceapi.com';
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

