<?php

namespace App\Filament\Resources\Transactions;

use App\Filament\Concerns\HasPanelRoleAuthorization;
use App\Filament\Resources\Transactions\Pages\ManageTransactions;
use App\Models\Transaction;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Enums\FiltersLayout;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class TransactionResource extends Resource
{
    use HasPanelRoleAuthorization;

    protected static ?string $model = Transaction::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?string $navigationLabel = 'Transactions';

    protected static string|\UnitEnum|null $navigationGroup = 'Operations';

    protected static ?int $navigationSort = 50;

    protected static array $viewAnyRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
        User::ADMIN_ROLE_OPERATIONS,
        User::ADMIN_ROLE_COMPLIANCE,
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
                    ->preload(),
                Select::make('type')
                    ->options([
                        'deposit' => 'Deposit',
                        'transfer' => 'Transfer',
                        'withdraw' => 'Withdraw',
                        'withdraw_refund' => 'Withdraw refund',
                        'exchange' => 'Exchange',
                        'card_charge' => 'Card charge',
                        'fee' => 'Fee',
                        'cashback' => 'Cashback',
                        'adjustment' => 'Adjustment',
                    ])
                    ->required(),
                Select::make('direction')
                    ->options([
                        'credit' => 'Credit',
                        'debit' => 'Debit',
                    ])
                    ->required(),
                TextInput::make('amount')
                    ->numeric()
                    ->required(),
                TextInput::make('fee')
                    ->numeric()
                    ->default(0)
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
                        'reversed' => 'Reversed',
                    ])
                    ->required(),
                TextInput::make('reference')
                    ->required()
                    ->maxLength(191)
                    ->unique(ignoreRecord: true),
                TextInput::make('description')
                    ->maxLength(191),
                TextInput::make('related_type')
                    ->label('Related model')
                    ->maxLength(191),
                TextInput::make('related_id')
                    ->numeric(),
                DateTimePicker::make('occurred_at'),
                KeyValue::make('meta')
                    ->columnSpanFull(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('occurred_at', 'desc')
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
                    ->formatStateUsing(fn (?string $state): string => strtoupper((string) $state))
                    ->toggleable(),
                TextColumn::make('type')
                    ->badge(),
                TextColumn::make('direction')
                    ->badge()
                    ->color(fn (string $state): string => $state === 'credit' ? 'success' : 'danger'),
                TextColumn::make('amount')
                    ->numeric(decimalPlaces: 2)
                    ->sortable(),
                TextColumn::make('fee')
                    ->numeric(decimalPlaces: 2)
                    ->toggleable(),
                TextColumn::make('net_amount')
                    ->numeric(decimalPlaces: 2)
                    ->sortable(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'completed' => 'success',
                        'processing', 'pending' => 'warning',
                        'failed', 'cancelled' => 'danger',
                        'reversed' => 'gray',
                        default => 'gray',
                    }),
                TextColumn::make('description')
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('occurred_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('type')
                    ->options([
                        'deposit' => 'Deposit',
                        'transfer' => 'Transfer',
                        'withdraw' => 'Withdraw',
                        'withdraw_refund' => 'Withdraw refund',
                        'exchange' => 'Exchange',
                        'card_charge' => 'Card charge',
                        'fee' => 'Fee',
                        'cashback' => 'Cashback',
                        'adjustment' => 'Adjustment',
                    ]),
                SelectFilter::make('direction')
                    ->options([
                        'credit' => 'Credit',
                        'debit' => 'Debit',
                    ]),
                SelectFilter::make('status')
                    ->options([
                        'pending' => 'Pending',
                        'processing' => 'Processing',
                        'completed' => 'Completed',
                        'failed' => 'Failed',
                        'cancelled' => 'Cancelled',
                        'reversed' => 'Reversed',
                    ]),
                SelectFilter::make('currency')
                    ->label('Wallet currency')
                    ->options([
                        'usd' => 'USD',
                        'usdt' => 'USDT',
                        'sol' => 'SOL',
                    ])
                    ->query(function (Builder $query, array $data): Builder {
                        $currency = strtolower(trim((string) ($data['value'] ?? '')));
                        if ($currency === '') {
                            return $query;
                        }

                        return $query->whereHas('wallet', function (Builder $walletQuery) use ($currency): void {
                            $walletQuery->where('currency', $currency);
                        });
                    }),
            ])
            ->filtersLayout(FiltersLayout::AboveContentCollapsible)
            ->filtersFormColumns(4)
            ->deferFilters()
            ->recordActions([
                Action::make('mark_completed')
                    ->label('Mark Completed')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn (Transaction $record): bool => self::canEdit($record) && in_array($record->status, ['pending', 'processing'], true))
                    ->action(fn (Transaction $record): bool => $record->update(['status' => 'completed'])),
                Action::make('mark_failed')
                    ->label('Mark Failed')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->visible(fn (Transaction $record): bool => self::canEdit($record) && in_array($record->status, ['pending', 'processing'], true))
                    ->action(fn (Transaction $record): bool => $record->update(['status' => 'failed'])),
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ])
            ->striped()
            ->emptyStateIcon('heroicon-o-list-bullet')
            ->emptyStateHeading('No transactions found')
            ->emptyStateDescription('Ledger movements will appear here.');
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageTransactions::route('/'),
        ];
    }
}
