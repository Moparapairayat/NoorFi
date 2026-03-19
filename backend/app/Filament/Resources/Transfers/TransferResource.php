<?php

namespace App\Filament\Resources\Transfers;

use App\Filament\Concerns\HasPanelRoleAuthorization;
use App\Filament\Resources\Transfers\Pages\ManageTransfers;
use App\Models\Transfer;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
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

class TransferResource extends Resource
{
    use HasPanelRoleAuthorization;

    protected static ?string $model = Transfer::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?string $navigationLabel = 'Transfers';

    protected static string|\UnitEnum|null $navigationGroup = 'Operations';

    protected static ?int $navigationSort = 30;

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
                        'noorfi_user' => 'NoorFi user',
                        'bank' => 'Bank transfer',
                        'wallet' => 'Wallet transfer',
                    ])
                    ->required(),
                TextInput::make('recipient_label')
                    ->required()
                    ->maxLength(191),
                TextInput::make('destination')
                    ->required()
                    ->maxLength(191),
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
                DateTimePicker::make('completed_at'),
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
                TextColumn::make('recipient_label')
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('destination')
                    ->toggleable(),
                TextColumn::make('amount')
                    ->numeric(decimalPlaces: 2)
                    ->sortable(),
                TextColumn::make('fee')
                    ->numeric(decimalPlaces: 2)
                    ->toggleable(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'completed' => 'success',
                        'processing', 'pending' => 'warning',
                        'failed', 'cancelled' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('completed_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('method')
                    ->options([
                        'noorfi_user' => 'NoorFi user',
                        'bank' => 'Bank transfer',
                        'wallet' => 'Wallet transfer',
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
                    ->visible(fn (Transfer $record): bool => self::canEdit($record) && $record->status === 'pending')
                    ->action(fn (Transfer $record): bool => $record->update(['status' => 'processing'])),
                Action::make('mark_completed')
                    ->label('Mark Completed')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn (Transfer $record): bool => self::canEdit($record) && in_array($record->status, ['pending', 'processing'], true))
                    ->action(function (Transfer $record): bool {
                        return $record->update([
                            'status' => 'completed',
                            'completed_at' => $record->completed_at ?? now(),
                        ]);
                    }),
                Action::make('mark_failed')
                    ->label('Mark Failed')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->visible(fn (Transfer $record): bool => self::canEdit($record) && in_array($record->status, ['pending', 'processing'], true))
                    ->action(fn (Transfer $record): bool => $record->update(['status' => 'failed'])),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ])
            ->striped()
            ->emptyStateIcon('heroicon-o-paper-airplane')
            ->emptyStateHeading('No transfers found')
            ->emptyStateDescription('User transfer records will appear here.');
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageTransfers::route('/'),
        ];
    }
}
