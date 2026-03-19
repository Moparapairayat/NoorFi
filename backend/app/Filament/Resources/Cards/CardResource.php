<?php

namespace App\Filament\Resources\Cards;

use App\Filament\Concerns\HasPanelRoleAuthorization;
use App\Filament\Resources\Cards\Pages\ManageCards;
use App\Models\Card;
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
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Enums\FiltersLayout;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class CardResource extends Resource
{
    use HasPanelRoleAuthorization;

    protected static ?string $model = Card::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?string $navigationLabel = 'Cards';

    protected static string|\UnitEnum|null $navigationGroup = 'Operations';

    protected static ?int $navigationSort = 10;

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
                    ->preload(),
                Select::make('type')
                    ->options([
                        'virtual' => 'Virtual',
                        'physical' => 'Physical',
                    ])
                    ->required(),
                TextInput::make('template_name')
                    ->required()
                    ->maxLength(191),
                TextInput::make('holder_name')
                    ->required()
                    ->maxLength(191),
                Select::make('brand')
                    ->options([
                        'mastercard' => 'Mastercard',
                        'visa' => 'Visa',
                    ])
                    ->required(),
                TextInput::make('theme')
                    ->required()
                    ->maxLength(40),
                Select::make('status')
                    ->options([
                        'pending' => 'Pending',
                        'active' => 'Active',
                        'frozen' => 'Frozen',
                        'cancelled' => 'Cancelled',
                        'failed' => 'Failed',
                    ])
                    ->required(),
                TextInput::make('last4')
                    ->label('Last 4')
                    ->maxLength(4),
                TextInput::make('masked_number')
                    ->maxLength(32),
                TextInput::make('expiry_month')
                    ->numeric()
                    ->minValue(1)
                    ->maxValue(12),
                TextInput::make('expiry_year')
                    ->numeric()
                    ->minValue(2024)
                    ->maxValue(2100),
                DateTimePicker::make('issued_at'),
                DateTimePicker::make('frozen_at'),
                KeyValue::make('meta')
                    ->columnSpanFull(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('id')
                    ->sortable(),
                TextColumn::make('user.email')
                    ->label('User')
                    ->searchable(),
                TextColumn::make('type')
                    ->badge()
                    ->sortable(),
                TextColumn::make('brand')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => strtoupper($state))
                    ->sortable(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'success',
                        'pending' => 'warning',
                        'frozen', 'failed' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('wallet.currency')
                    ->label('Wallet')
                    ->formatStateUsing(fn (?string $state): string => strtoupper((string) $state))
                    ->toggleable(),
                TextColumn::make('last4')
                    ->label('Last 4')
                    ->toggleable(),
                TextColumn::make('issued_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->dateTime('Y-m-d H:i')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('type')
                    ->options([
                        'virtual' => 'Virtual',
                        'physical' => 'Physical',
                    ]),
                SelectFilter::make('brand')
                    ->options([
                        'mastercard' => 'Mastercard',
                        'visa' => 'Visa',
                    ]),
                SelectFilter::make('status')
                    ->options([
                        'pending' => 'Pending',
                        'active' => 'Active',
                        'frozen' => 'Frozen',
                        'cancelled' => 'Cancelled',
                        'failed' => 'Failed',
                    ]),
            ])
            ->filtersLayout(FiltersLayout::AboveContentCollapsible)
            ->filtersFormColumns(3)
            ->deferFilters()
            ->recordActions([
                Action::make('activate')
                    ->label('Activate')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn (Card $record): bool => self::canEdit($record) && $record->status === 'pending')
                    ->action(fn (Card $record): bool => $record->update(['status' => 'active'])),
                Action::make('freeze')
                    ->label('Freeze')
                    ->icon('heroicon-o-pause-circle')
                    ->color('warning')
                    ->visible(fn (Card $record): bool => self::canEdit($record) && $record->status === 'active')
                    ->action(function (Card $record): bool {
                        return $record->update([
                            'status' => 'frozen',
                            'frozen_at' => now(),
                        ]);
                    }),
                Action::make('unfreeze')
                    ->label('Unfreeze')
                    ->icon('heroicon-o-play-circle')
                    ->color('success')
                    ->visible(fn (Card $record): bool => self::canEdit($record) && $record->status === 'frozen')
                    ->action(function (Card $record): bool {
                        return $record->update([
                            'status' => 'active',
                            'frozen_at' => null,
                        ]);
                    }),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ])
            ->striped()
            ->emptyStateIcon('heroicon-o-credit-card')
            ->emptyStateHeading('No cards found')
            ->emptyStateDescription('Card applications and issued cards will appear here.');
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageCards::route('/'),
        ];
    }

    public static function getNavigationBadge(): ?string
    {
        $count = Card::query()
            ->whereIn('status', ['pending', 'frozen'])
            ->count();

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Pending or frozen cards.';
    }

    public static function getNavigationBadgeColor(): string|array|null
    {
        return 'warning';
    }
}
