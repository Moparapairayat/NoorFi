<?php

namespace App\Filament\Pages;

use App\Models\SystemSetting;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\ToggleButtons;
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

class StrowalletVirtualCardApiPage extends Page
{
    protected static ?string $title = 'Setup Virtual Card API';

    protected static ?string $slug = 'virtual-card-api';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCreditCard;

    protected static ?string $navigationLabel = 'Virtual Card API';

    protected static string|UnitEnum|null $navigationGroup = 'Infrastructure';

    protected static ?int $navigationSort = 6;

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
        return 'Setup Virtual Card API';
    }

    public function getSubheading(): ?string
    {
        return 'Configure Strowallet credentials, mode, base URL, webhook, and card limits from one place.';
    }

    public function defaultForm(Schema $schema): Schema
    {
        return $schema->statePath('data');
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Virtual Card API')
                    ->description('Strowallet virtual card provider setup')
                    ->schema([
                        TextInput::make('name')
                            ->label('Name')
                            ->default('Strowallet API')
                            ->disabled()
                            ->dehydrated(false)
                            ->columnSpanFull(),

                        Grid::make(3)
                            ->schema([
                                TextInput::make('public_key')
                                    ->label('Public Key')
                                    ->required()
                                    ->prefixIcon('heroicon-o-key')
                                    ->maxLength(255),
                                TextInput::make('secret_key')
                                    ->label('Secret Key')
                                    ->password()
                                    ->revealable()
                                    ->required()
                                    ->prefixIcon('heroicon-o-key')
                                    ->maxLength(255),
                                TextInput::make('base_url')
                                    ->label('Base URL')
                                    ->url()
                                    ->required()
                                    ->prefixIcon('heroicon-o-link')
                                    ->maxLength(255),
                            ]),

                        Grid::make(2)
                            ->schema([
                                ToggleButtons::make('mode')
                                    ->label('Mode')
                                    ->options([
                                        'live' => 'Live',
                                        'sandbox' => 'Sandbox',
                                    ])
                                    ->colors([
                                        'live' => 'success',
                                        'sandbox' => 'danger',
                                    ])
                                    ->icons([
                                        'live' => Heroicon::CheckCircle,
                                        'sandbox' => Heroicon::Beaker,
                                    ])
                                    ->grouped()
                                    ->inline()
                                    ->required(),
                                TextInput::make('webhook_url')
                                    ->label('Webhook URL')
                                    ->url()
                                    ->copyable()
                                    ->prefixIcon('heroicon-o-link')
                                    ->maxLength(2048),
                            ]),

                        TextInput::make('card_limit_per_user')
                            ->label('Card Limit (1 to 3)')
                            ->numeric()
                            ->minValue(1)
                            ->maxValue(3)
                            ->required(),
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
                    ->id('strowallet-virtual-card-api-form')
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

        $baseUrl = $this->normalizeBaseUrl((string) ($state['base_url'] ?? ''));
        $mode = strtolower(trim((string) ($state['mode'] ?? 'sandbox')));
        $mode = in_array($mode, ['sandbox', 'live'], true) ? $mode : 'sandbox';

        $limit = (int) ($state['card_limit_per_user'] ?? 3);
        $limit = max(min($limit, 3), 1);

        DB::transaction(function () use ($state, $baseUrl, $mode, $limit): void {
            $this->put('services.strowallet.public_key', trim((string) ($state['public_key'] ?? '')));
            $this->put('services.strowallet.secret_key', trim((string) ($state['secret_key'] ?? '')));
            $this->put('services.strowallet.base_url', $baseUrl);
            $this->put('services.strowallet.mode', $mode);
            $this->put('services.strowallet.webhook_url', trim((string) ($state['webhook_url'] ?? '')));
            $this->put('services.strowallet.card_limit_per_user', $limit);

            foreach ($this->buildEndpointMapFromBaseUrl($baseUrl) as $key => $value) {
                $this->put($key, $value);
            }
        });

        $this->form->fill($this->getFormState());

        Notification::make()
            ->success()
            ->title('Strowallet setup updated')
            ->body('Virtual card API setup and endpoint values were saved successfully.')
            ->send();
    }

    /**
     * @return array<string, mixed>
     */
    private function getFormState(): array
    {
        $defaultWebhookUrl = rtrim((string) config('app.url', ''), '/') . '/api/providers/strowallet/webhook';
        $createCardEndpoint = (string) config('services.strowallet.create_card_endpoint', '');
        $configuredBaseUrl = (string) config('services.strowallet.base_url', '');

        return [
            'name' => 'Strowallet API',
            'public_key' => (string) config('services.strowallet.public_key', ''),
            'secret_key' => (string) config('services.strowallet.secret_key', ''),
            'base_url' => $configuredBaseUrl !== '' ? $configuredBaseUrl : $this->inferBaseUrlFromCreateCardEndpoint($createCardEndpoint),
            'mode' => (string) config('services.strowallet.mode', 'sandbox'),
            'webhook_url' => (string) config('services.strowallet.webhook_url', $defaultWebhookUrl),
            'card_limit_per_user' => (int) config('services.strowallet.card_limit_per_user', 3),
        ];
    }

    /**
     * @return array<string, string>
     */
    private function buildEndpointMapFromBaseUrl(string $baseUrl): array
    {
        $base = $this->normalizeBaseUrl($baseUrl);

        return [
            'services.strowallet.create_customer_endpoint' => "{$base}/create-user",
            'services.strowallet.get_customer_endpoint' => "{$base}/getcardholder",
            'services.strowallet.create_card_endpoint' => "{$base}/create-card",
            'services.strowallet.card_details_endpoint' => "{$base}/fetch-card-detail",
            'services.strowallet.card_transactions_endpoint' => "{$base}/card-transactions",
            'services.strowallet.freeze_unfreeze_endpoint' => "{$base}/action/status",
            'services.strowallet.upgrade_card_limit_endpoint' => "{$base}/upgradecardlimit",
        ];
    }

    private function inferBaseUrlFromCreateCardEndpoint(string $createCardEndpoint): string
    {
        $normalized = trim($createCardEndpoint);
        if ($normalized === '') {
            return 'https://strowallet.com/api/bitvcard';
        }

        if (str_ends_with($normalized, '/create-card')) {
            return substr($normalized, 0, -strlen('/create-card'));
        }

        return rtrim($normalized, '/');
    }

    private function normalizeBaseUrl(string $baseUrl): string
    {
        $normalized = rtrim(trim($baseUrl), '/');

        return $normalized !== '' ? $normalized : 'https://strowallet.com/api/bitvcard';
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
