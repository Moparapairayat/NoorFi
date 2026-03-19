<?php

namespace App\Filament\Resources\ProviderWebhookLogs;

use App\Filament\Concerns\HasPanelRoleAuthorization;
use App\Filament\Resources\ProviderWebhookLogs\Pages\ManageProviderWebhookLogs;
use App\Models\ProviderWebhookLog;
use App\Models\User;
use BackedEnum;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Enums\FiltersLayout;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class ProviderWebhookLogResource extends Resource
{
    use HasPanelRoleAuthorization;

    protected static ?string $model = ProviderWebhookLog::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedSignal;

    protected static ?string $navigationLabel = 'Webhook Logs';

    protected static string|\UnitEnum|null $navigationGroup = 'Infrastructure';

    protected static ?int $navigationSort = 10;

    protected static array $viewAnyRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
        User::ADMIN_ROLE_OPERATIONS,
        User::ADMIN_ROLE_COMPLIANCE,
    ];

    protected static array $createRoles = [];

    protected static array $editRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
    ];

    protected static array $deleteRoles = [];

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('provider')
                    ->required()
                    ->maxLength(64),
                TextInput::make('topic')
                    ->maxLength(64),
                TextInput::make('event_key')
                    ->maxLength(191),
                TextInput::make('event_hash')
                    ->required()
                    ->maxLength(64),
                TextInput::make('attempt_count')
                    ->numeric()
                    ->required(),
                Select::make('process_status')
                    ->options([
                        'received' => 'Received',
                        'processing' => 'Processing',
                        'processed' => 'Processed',
                        'ignored' => 'Ignored',
                        'failed' => 'Failed',
                    ])
                    ->required(),
                Textarea::make('process_message')
                    ->rows(2)
                    ->maxLength(1000),
                DateTimePicker::make('received_at')
                    ->required(),
                DateTimePicker::make('processed_at'),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('received_at', 'desc')
            ->columns([
                TextColumn::make('id')
                    ->sortable(),
                TextColumn::make('provider')
                    ->badge()
                    ->searchable(),
                TextColumn::make('topic')
                    ->badge()
                    ->toggleable(),
                TextColumn::make('event_key')
                    ->label('Event key')
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('event_hash')
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('attempt_count')
                    ->sortable(),
                TextColumn::make('process_status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'processed' => 'success',
                        'processing', 'received' => 'warning',
                        'ignored' => 'gray',
                        'failed' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('received_at')
                    ->dateTime('Y-m-d H:i')
                    ->sortable(),
                TextColumn::make('processed_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(),
            ])
            ->filters([
                SelectFilter::make('provider')
                    ->options([
                        'didit' => 'Didit',
                        'heleket' => 'Heleket',
                        'binance_pay' => 'Binance Pay',
                        'strowallet' => 'Strowallet',
                    ]),
                SelectFilter::make('process_status')
                    ->options([
                        'received' => 'Received',
                        'processing' => 'Processing',
                        'processed' => 'Processed',
                        'ignored' => 'Ignored',
                        'failed' => 'Failed',
                    ]),
            ])
            ->filtersLayout(FiltersLayout::AboveContentCollapsible)
            ->filtersFormColumns(3)
            ->deferFilters()
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([])
            ->striped()
            ->emptyStateIcon('heroicon-o-signal')
            ->emptyStateHeading('No webhook logs found')
            ->emptyStateDescription('Incoming provider webhook events will appear here.');
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageProviderWebhookLogs::route('/'),
        ];
    }

    public static function getNavigationBadge(): ?string
    {
        $count = ProviderWebhookLog::query()
            ->where('process_status', 'failed')
            ->count();

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Failed webhook events.';
    }

    public static function getNavigationBadgeColor(): string|array|null
    {
        return 'danger';
    }
}
