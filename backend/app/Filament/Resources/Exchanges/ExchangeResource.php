<?php

namespace App\Filament\Resources\Exchanges;

use App\Filament\Concerns\HasPanelRoleAuthorization;
use App\Filament\Resources\Exchanges\Pages\ManageExchanges;
use App\Models\Exchange;
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

class ExchangeResource extends Resource
{
    use HasPanelRoleAuthorization;

    protected static ?string $model = Exchange::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?string $navigationLabel = 'Exchanges';

    protected static string|\UnitEnum|null $navigationGroup = 'Operations';

    protected static ?int $navigationSort = 40;

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
                Select::make('from_wallet_id')
                    ->relationship('fromWallet', 'currency')
                    ->label('From wallet')
                    ->searchable()
                    ->preload()
                    ->required(),
                Select::make('to_wallet_id')
                    ->relationship('toWallet', 'currency')
                    ->label('To wallet')
                    ->searchable()
                    ->preload()
                    ->required(),
                TextInput::make('amount_from')
                    ->numeric()
                    ->required(),
                TextInput::make('amount_to')
                    ->numeric()
                    ->required(),
                TextInput::make('rate')
                    ->numeric()
                    ->required(),
                TextInput::make('fee')
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
                TextInput::make('quote_id')
                    ->maxLength(191),
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
                TextColumn::make('fromWallet.currency')
                    ->label('From')
                    ->formatStateUsing(fn (?string $state): string => strtoupper((string) $state)),
                TextColumn::make('toWallet.currency')
                    ->label('To')
                    ->formatStateUsing(fn (?string $state): string => strtoupper((string) $state)),
                TextColumn::make('amount_from')
                    ->numeric(decimalPlaces: 2)
                    ->sortable(),
                TextColumn::make('amount_to')
                    ->numeric(decimalPlaces: 2)
                    ->sortable(),
                TextColumn::make('rate')
                    ->numeric(decimalPlaces: 6)
                    ->toggleable(),
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
                    ->visible(fn (Exchange $record): bool => self::canEdit($record) && $record->status === 'pending')
                    ->action(fn (Exchange $record): bool => $record->update(['status' => 'processing'])),
                Action::make('mark_completed')
                    ->label('Mark Completed')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn (Exchange $record): bool => self::canEdit($record) && in_array($record->status, ['pending', 'processing'], true))
                    ->action(function (Exchange $record): bool {
                        return $record->update([
                            'status' => 'completed',
                            'completed_at' => $record->completed_at ?? now(),
                        ]);
                    }),
                Action::make('mark_failed')
                    ->label('Mark Failed')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->visible(fn (Exchange $record): bool => self::canEdit($record) && in_array($record->status, ['pending', 'processing'], true))
                    ->action(fn (Exchange $record): bool => $record->update(['status' => 'failed'])),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ])
            ->striped()
            ->emptyStateIcon('heroicon-o-arrows-right-left')
            ->emptyStateHeading('No exchanges found')
            ->emptyStateDescription('Currency conversion records will appear here.');
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageExchanges::route('/'),
        ];
    }
}
