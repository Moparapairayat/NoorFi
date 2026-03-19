<?php

namespace App\Filament\Resources\UserStaticWallets;

use App\Filament\Concerns\HasPanelRoleAuthorization;
use App\Filament\Resources\UserStaticWallets\Pages\ManageUserStaticWallets;
use App\Models\User;
use App\Models\UserStaticWallet;
use BackedEnum;
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

class UserStaticWalletResource extends Resource
{
    use HasPanelRoleAuthorization;

    protected static ?string $model = UserStaticWallet::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedWallet;

    protected static ?string $navigationLabel = 'Static Wallets';

    protected static string|\UnitEnum|null $navigationGroup = 'Operations';

    protected static ?int $navigationSort = 45;

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
                Select::make('provider')
                    ->options([
                        'heleket' => 'Heleket',
                        'binance_pay' => 'Binance Pay',
                        'strowallet' => 'Strowallet',
                    ])
                    ->required(),
                TextInput::make('currency')
                    ->required()
                    ->maxLength(16),
                TextInput::make('network')
                    ->required()
                    ->maxLength(24),
                TextInput::make('order_id')
                    ->required()
                    ->maxLength(100),
                TextInput::make('wallet_uuid')
                    ->maxLength(191),
                TextInput::make('address_uuid')
                    ->maxLength(191),
                TextInput::make('address')
                    ->required()
                    ->maxLength(191),
                TextInput::make('payment_url')
                    ->url()
                    ->maxLength(255),
                TextInput::make('callback_url')
                    ->url()
                    ->maxLength(255),
                KeyValue::make('meta')
                    ->columnSpanFull(),
                DateTimePicker::make('last_used_at'),
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
                TextColumn::make('wallet.currency')
                    ->label('Wallet')
                    ->formatStateUsing(fn (?string $state): string => strtoupper((string) $state)),
                TextColumn::make('provider')
                    ->badge(),
                TextColumn::make('currency')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => strtoupper($state)),
                TextColumn::make('network')
                    ->badge(),
                TextColumn::make('order_id')
                    ->searchable()
                    ->copyable(),
                TextColumn::make('address')
                    ->copyable()
                    ->limit(24),
                TextColumn::make('last_used_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('provider')
                    ->options([
                        'heleket' => 'Heleket',
                        'binance_pay' => 'Binance Pay',
                        'strowallet' => 'Strowallet',
                    ]),
                SelectFilter::make('currency')
                    ->options([
                        'USD' => 'USD',
                        'USDT' => 'USDT',
                        'SOL' => 'SOL',
                    ]),
                SelectFilter::make('network')
                    ->options([
                        'TRC20' => 'TRC20',
                        'SOL' => 'SOL',
                        'ERC20' => 'ERC20',
                        'BEP20' => 'BEP20',
                    ]),
            ])
            ->filtersLayout(FiltersLayout::AboveContentCollapsible)
            ->filtersFormColumns(3)
            ->deferFilters()
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ])
            ->striped()
            ->emptyStateIcon('heroicon-o-wallet')
            ->emptyStateHeading('No static wallets found')
            ->emptyStateDescription('Generated deposit addresses and payment URLs will appear here.');
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageUserStaticWallets::route('/'),
        ];
    }
}
