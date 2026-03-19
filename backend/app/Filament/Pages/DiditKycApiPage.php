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

class DiditKycApiPage extends Page
{
    protected static ?string $title = 'Setup KYC API';

    protected static ?string $slug = 'didit-kyc-api';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedShieldCheck;

    protected static ?string $navigationLabel = 'Didit KYC API';

    protected static string|UnitEnum|null $navigationGroup = 'Infrastructure';

    protected static ?int $navigationSort = 7;

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
        return 'Setup KYC API';
    }

    public function getSubheading(): ?string
    {
        return 'Configure Didit API key, workflow, callback, webhook signature, and runtime behavior.';
    }

    public function defaultForm(Schema $schema): Schema
    {
        return $schema->statePath('data');
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('KYC API')
                    ->description('Didit provider setup')
                    ->schema([
                        TextInput::make('name')
                            ->label('Name')
                            ->default('Didit KYC API')
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
                                TextInput::make('workflow_id')
                                    ->label('Workflow ID')
                                    ->required()
                                    ->maxLength(191),
                                TextInput::make('base_url')
                                    ->label('Base URL')
                                    ->url()
                                    ->required()
                                    ->prefixIcon('heroicon-o-link')
                                    ->maxLength(255),
                            ]),

                        Grid::make(2)
                            ->schema([
                                TextInput::make('webhook_secret')
                                    ->label('Webhook Secret')
                                    ->password()
                                    ->revealable()
                                    ->required()
                                    ->prefixIcon('heroicon-o-key')
                                    ->maxLength(255),
                                TextInput::make('callback_url')
                                    ->label('Callback URL')
                                    ->url()
                                    ->prefixIcon('heroicon-o-link')
                                    ->maxLength(2048),
                            ]),

                        Grid::make(3)
                            ->schema([
                                ToggleButtons::make('callback_method')
                                    ->label('Callback Method')
                                    ->options([
                                        'initiator' => 'Initiator',
                                        'redirect' => 'Redirect',
                                    ])
                                    ->colors([
                                        'initiator' => 'info',
                                        'redirect' => 'warning',
                                    ])
                                    ->grouped()
                                    ->inline()
                                    ->required(),
                                TextInput::make('language')
                                    ->label('Language')
                                    ->required()
                                    ->maxLength(10),
                                TextInput::make('timeout_seconds')
                                    ->label('Timeout (seconds)')
                                    ->numeric()
                                    ->minValue(5)
                                    ->maxValue(120)
                                    ->required(),
                            ]),

                        Grid::make(2)
                            ->schema([
                                ToggleButtons::make('send_notification_emails')
                                    ->label('Notification Emails')
                                    ->boolean('Enabled', 'Disabled')
                                    ->grouped()
                                    ->inline()
                                    ->required(),
                                TextInput::make('webhook_endpoint')
                                    ->label('Webhook Endpoint')
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
                    ->id('didit-kyc-api-form')
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
        $callbackMethod = strtolower(trim((string) ($state['callback_method'] ?? 'initiator')));
        $callbackMethod = in_array($callbackMethod, ['initiator', 'redirect'], true) ? $callbackMethod : 'initiator';
        $timeout = (int) ($state['timeout_seconds'] ?? 25);
        $timeout = max(min($timeout, 120), 5);
        $callbackUrl = trim((string) ($state['callback_url'] ?? ''));
        $language = strtolower(trim((string) ($state['language'] ?? 'en')));
        if ($language === '') {
            $language = 'en';
        }

        DB::transaction(function () use ($state, $baseUrl, $callbackMethod, $timeout, $callbackUrl, $language): void {
            $this->put('services.didit.api_key', trim((string) ($state['api_key'] ?? '')));
            $this->put('services.didit.workflow_id', trim((string) ($state['workflow_id'] ?? '')));
            $this->put('services.didit.base_url', $baseUrl);
            $this->put('services.didit.webhook_secret', trim((string) ($state['webhook_secret'] ?? '')));
            $this->put('services.didit.callback_url', $callbackUrl);
            $this->put('services.didit.callback_method', $callbackMethod);
            $this->put('services.didit.language', $language);
            $this->put('services.didit.send_notification_emails', (bool) ($state['send_notification_emails'] ?? false));
            $this->put('services.didit.timeout_seconds', $timeout);
        });

        $this->form->fill($this->getFormState());

        Notification::make()
            ->success()
            ->title('Didit setup updated')
            ->body('KYC API setup values were saved successfully.')
            ->send();
    }

    /**
     * @return array<string, mixed>
     */
    private function getFormState(): array
    {
        $appUrl = rtrim((string) config('app.url', ''), '/');
        $defaultWebhookEndpoint = $appUrl . '/api/kyc/didit/webhook';
        $defaultCallbackUrl = $appUrl !== '' ? ($appUrl . '/api/kyc/didit/callback') : '';

        return [
            'name' => 'Didit KYC API',
            'api_key' => (string) config('services.didit.api_key', ''),
            'workflow_id' => (string) config('services.didit.workflow_id', ''),
            'base_url' => (string) config('services.didit.base_url', 'https://verification.didit.me'),
            'webhook_secret' => (string) config('services.didit.webhook_secret', ''),
            'callback_url' => (string) config('services.didit.callback_url', $defaultCallbackUrl),
            'callback_method' => (string) config('services.didit.callback_method', 'initiator'),
            'language' => (string) config('services.didit.language', 'en'),
            'send_notification_emails' => (bool) config('services.didit.send_notification_emails', false),
            'timeout_seconds' => (int) config('services.didit.timeout_seconds', 25),
            'webhook_endpoint' => $defaultWebhookEndpoint,
        ];
    }

    private function normalizeBaseUrl(string $baseUrl): string
    {
        $normalized = rtrim(trim($baseUrl), '/');

        return $normalized !== '' ? $normalized : 'https://verification.didit.me';
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

