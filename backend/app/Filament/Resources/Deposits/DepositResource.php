<?php

namespace App\Filament\Resources\Deposits;

use App\Filament\Concerns\HasPanelRoleAuthorization;
use App\Filament\Resources\Deposits\Pages\ManageDeposits;
use App\Models\Deposit;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\KeyValue;
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

class DepositResource extends Resource
{
    use HasPanelRoleAuthorization;

    protected static ?string $model = Deposit::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?string $navigationLabel = 'Deposits';

    protected static string|\UnitEnum|null $navigationGroup = 'Operations';

    protected static ?int $navigationSort = 20;

    protected static array $viewAnyRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
        User::ADMIN_ROLE_OPERATIONS,
    ];

    protected static array $createRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
        User::ADMIN_ROLE_OPERATIONS,
    ];

    protected static array $editRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
        User::ADMIN_ROLE_OPERATIONS,
    ];

    protected static array $deleteRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
    ];

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('user_id')
                    ->relationship('user', 'email')
                    ->searchable()
                    ->preload()
                    ->required(),
                Select::make('wallet_id')
                    ->relationship('wallet', 'currency')
                    ->searchable()
                    ->preload()
                    ->required(),
                Select::make('method')
                    ->options([
                        'binance_pay' => 'Binance Pay',
                        'crypto_wallet' => 'Crypto wallet',
                        'heleket' => 'Heleket',
                    ])
                    ->required(),
                TextInput::make('amount')
                    ->numeric()
                    ->required(),
                TextInput::make('fee')
                    ->numeric()
                    ->required(),
                TextInput::make('net_amount')
                    ->numeric()
                    ->required(),
                Select::make('status')
                    ->options([
                        'pending' => 'Pending',
                        'processing' => 'Processing',
                        'completed' => 'Completed',
                        'failed' => 'Failed',
                        'cancelled' => 'Cancelled',
                    ])
                    ->required(),
                TextInput::make('reference')
                    ->required()
                    ->maxLength(191),
                Textarea::make('note')
                    ->rows(2)
                    ->maxLength(255),
                KeyValue::make('instructions')
                    ->columnSpanFull(),
                DateTimePicker::make('credited_at'),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('id')
                    ->sortable(),
                TextColumn::make('reference')
                    ->searchable()
                    ->copyable(),
                TextColumn::make('user.email')
                    ->label('User')
                    ->searchable(),
                TextColumn::make('wallet.currency')
                    ->label('Wallet')
                    ->formatStateUsing(fn (?string $state): string => strtoupper((string) $state)),
                TextColumn::make('method')
                    ->badge(),
                TextColumn::make('amount')
                    ->numeric(decimalPlaces: 2)
                    ->sortable(),
                TextColumn::make('fee')
                    ->numeric(decimalPlaces: 2)
                    ->toggleable(),
                TextColumn::make('net_amount')
                    ->numeric(decimalPlaces: 2),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'completed' => 'success',
                        'processing', 'pending' => 'warning',
                        'failed', 'cancelled' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('credited_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->dateTime('Y-m-d H:i')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('method')
                    ->options([
                        'binance_pay' => 'Binance Pay',
                        'crypto_wallet' => 'Crypto wallet',
                        'heleket' => 'Heleket',
                    ]),
                SelectFilter::make('status')
                    ->options([
                        'pending' => 'Pending',
                        'processing' => 'Processing',
                        'completed' => 'Completed',
                        'failed' => 'Failed',
                        'cancelled' => 'Cancelled',
                    ]),
            ])
            ->filtersLayout(FiltersLayout::AboveContentCollapsible)
            ->filtersFormColumns(3)
            ->deferFilters()
            ->recordActions([
                Action::make('mark_processing')
                    ->label('Mark Processing')
                    ->icon('heroicon-o-clock')
                    ->color('warning')
                    ->visible(fn (Deposit $record): bool => self::canEdit($record) && $record->status === 'pending')
                    ->action(fn (Deposit $record): bool => $record->update(['status' => 'processing'])),
                Action::make('mark_completed')
                    ->label('Mark Completed')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn (Deposit $record): bool => self::canEdit($record) && in_array($record->status, ['pending', 'processing'], true))
                    ->action(function (Deposit $record): bool {
                        return $record->update([
                            'status' => 'completed',
                            'credited_at' => $record->credited_at ?? now(),
                        ]);
                    }),
                Action::make('mark_failed')
                    ->label('Mark Failed')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->visible(fn (Deposit $record): bool => self::canEdit($record) && in_array($record->status, ['pending', 'processing'], true))
                    ->action(fn (Deposit $record): bool => $record->update(['status' => 'failed'])),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ])
            ->striped()
            ->emptyStateIcon('heroicon-o-arrow-down-circle')
            ->emptyStateHeading('No deposits found')
            ->emptyStateDescription('Incoming funding requests will appear here.');
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageDeposits::route('/'),
        ];
    }

    public static function getNavigationBadge(): ?string
    {
        $count = Deposit::query()
            ->whereIn('status', ['pending', 'processing'])
            ->count();

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Pending or processing deposits.';
    }

    public static function getNavigationBadgeColor(): string|array|null
    {
        return 'warning';
    }
}
