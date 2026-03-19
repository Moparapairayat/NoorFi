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
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Schema;
use Filament\Support\Enums\Alignment;
use Filament\Support\Icons\Heroicon;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Support\Facades\DB;
use UnitEnum;

class MailProviderApiPage extends Page
{
    protected static ?string $title = 'Setup Mail Provider';

    protected static ?string $slug = 'mail-provider-api';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedEnvelope;

    protected static ?string $navigationLabel = 'Mail Provider';

    protected static string|UnitEnum|null $navigationGroup = 'Infrastructure';

    protected static ?int $navigationSort = 10;

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
        return 'Setup Mail Provider';
    }

    public function getSubheading(): ?string
    {
        return 'Manage default mail driver, sender identity, Resend API key, and optional SMTP credentials.';
    }

    public function defaultForm(Schema $schema): Schema
    {
        return $schema->statePath('data');
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Mail Provider')
                    ->description('Email delivery setup used for OTP and system notifications')
                    ->schema([
                        TextInput::make('name')
                            ->label('Name')
                            ->default('Mail Provider')
                            ->disabled()
                            ->dehydrated(false)
                            ->columnSpanFull(),

                        ToggleButtons::make('provider')
                            ->label('Provider')
                            ->options([
                                'resend' => 'Resend',
                                'smtp' => 'SMTP',
                                'log' => 'Log',
                            ])
                            ->colors([
                                'resend' => 'success',
                                'smtp' => 'info',
                                'log' => 'gray',
                            ])
                            ->icons([
                                'resend' => Heroicon::Bolt,
                                'smtp' => Heroicon::Envelope,
                                'log' => Heroicon::DocumentText,
                            ])
                            ->grouped()
                            ->inline()
                            ->required(),

                        Grid::make(2)
                            ->schema([
                                TextInput::make('from_name')
                                    ->label('From Name')
                                    ->required()
                                    ->maxLength(191),
                                TextInput::make('from_address')
                                    ->label('From Address')
                                    ->email()
                                    ->required()
                                    ->maxLength(191),
                            ]),

                        TextInput::make('resend_api_key')
                            ->label('Resend API Key')
                            ->password()
                            ->revealable()
                            ->prefixIcon('heroicon-o-key')
                            ->maxLength(255)
                            ->visible(fn (Get $get): bool => (string) $get('provider') === 'resend'),

                        Grid::make(2)
                            ->schema([
                                TextInput::make('smtp_host')
                                    ->label('SMTP Host')
                                    ->maxLength(191),
                                TextInput::make('smtp_port')
                                    ->label('SMTP Port')
                                    ->numeric()
                                    ->minValue(1)
                                    ->maxValue(65535),
                                TextInput::make('smtp_username')
                                    ->label('SMTP Username')
                                    ->maxLength(191),
                                TextInput::make('smtp_password')
                                    ->label('SMTP Password')
                                    ->password()
                                    ->revealable()
                                    ->prefixIcon('heroicon-o-key')
                                    ->maxLength(255),
                                ToggleButtons::make('smtp_scheme')
                                    ->label('SMTP Scheme')
                                    ->options([
                                        'tls' => 'TLS',
                                        'ssl' => 'SSL',
                                        '' => 'None',
                                    ])
                                    ->colors([
                                        'tls' => 'success',
                                        'ssl' => 'info',
                                        '' => 'gray',
                                    ])
                                    ->grouped()
                                    ->inline(),
                            ])
                            ->visible(fn (Get $get): bool => (string) $get('provider') === 'smtp'),
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
                    ->id('mail-provider-api-form')
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

        $provider = strtolower(trim((string) ($state['provider'] ?? 'resend')));
        if (! in_array($provider, ['resend', 'smtp', 'log'], true)) {
            $provider = 'resend';
        }

        $smtpPort = (int) ($state['smtp_port'] ?? 587);
        $smtpPort = max(min($smtpPort, 65535), 1);

        $smtpScheme = strtolower(trim((string) ($state['smtp_scheme'] ?? 'tls')));
        if (! in_array($smtpScheme, ['tls', 'ssl', ''], true)) {
            $smtpScheme = 'tls';
        }

        DB::transaction(function () use ($state, $provider, $smtpPort, $smtpScheme): void {
            $this->put('mail.default', $provider);
            $this->put('mail.from.name', trim((string) ($state['from_name'] ?? '')));
            $this->put('mail.from.address', trim((string) ($state['from_address'] ?? '')));
            $this->put('services.resend.key', trim((string) ($state['resend_api_key'] ?? '')));

            $this->put('mail.mailers.smtp.host', trim((string) ($state['smtp_host'] ?? '')));
            $this->put('mail.mailers.smtp.port', $smtpPort);
            $this->put('mail.mailers.smtp.username', trim((string) ($state['smtp_username'] ?? '')));
            $this->put('mail.mailers.smtp.password', trim((string) ($state['smtp_password'] ?? '')));
            $this->put('mail.mailers.smtp.scheme', $smtpScheme);
        });

        $this->form->fill($this->getFormState());

        Notification::make()
            ->success()
            ->title('Mail provider setup updated')
            ->body('Mail driver, sender, and provider credentials were saved successfully.')
            ->send();
    }

    /**
     * @return array<string, mixed>
     */
    private function getFormState(): array
    {
        return [
            'name' => 'Mail Provider',
            'provider' => (string) config('mail.default', 'resend'),
            'from_name' => (string) config('mail.from.name', 'NoorFi'),
            'from_address' => (string) config('mail.from.address', ''),
            'resend_api_key' => (string) config('services.resend.key', ''),
            'smtp_host' => (string) config('mail.mailers.smtp.host', ''),
            'smtp_port' => (int) config('mail.mailers.smtp.port', 587),
            'smtp_username' => (string) config('mail.mailers.smtp.username', ''),
            'smtp_password' => (string) config('mail.mailers.smtp.password', ''),
            'smtp_scheme' => (string) config('mail.mailers.smtp.scheme', 'tls'),
        ];
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

