<?php

namespace App\Filament\Resources\SystemSettings;

use App\Filament\Concerns\HasPanelRoleAuthorization;
use App\Filament\Resources\SystemSettings\Pages\ManageSystemSettings;
use App\Models\SystemSetting;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Schema;
use Filament\Support\Enums\FontFamily;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Enums\FiltersLayout;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Grouping\Group;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class SystemSettingResource extends Resource
{
    use HasPanelRoleAuthorization;

    /**
     * Provider modules are managed from dedicated setup pages.
     *
     * @var array<int, string>
     */
    protected const HIDDEN_MODULES = [
        'mail',
        'strowallet',
        'didit',
        'heleket',
        'binance_pay',
    ];

    protected static ?string $model = SystemSetting::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCog6Tooth;

    protected static ?string $navigationLabel = 'System Settings';

    protected static string|\UnitEnum|null $navigationGroup = 'Infrastructure';

    protected static ?int $navigationSort = 5;

    protected static array $viewAnyRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
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
                Section::make('Configuration Key')
                    ->description('Locked metadata. Only setting value can be edited.')
                    ->schema([
                        Select::make('module')
                            ->options(SystemSetting::moduleOptions())
                            ->searchable()
                            ->required()
                            ->disabled()
                            ->dehydrated(false),
                        Select::make('type')
                            ->options(SystemSetting::typeOptions())
                            ->required()
                            ->disabled()
                            ->dehydrated(false),
                        Toggle::make('is_secret')
                            ->label('Secret value')
                            ->inline(false)
                            ->disabled()
                            ->dehydrated(false),
                        TextInput::make('key')
                            ->helperText('Example: services.didit.api_key')
                            ->required()
                            ->maxLength(191)
                            ->disabled()
                            ->dehydrated(false)
                            ->columnSpanFull(),
                        TextInput::make('label')
                            ->required()
                            ->maxLength(120)
                            ->disabled()
                            ->dehydrated(false)
                            ->columnSpanFull(),
                        Textarea::make('description')
                            ->rows(2)
                            ->disabled()
                            ->dehydrated(false)
                            ->columnSpanFull(),
                    ])
                    ->columns(3),

                Section::make('Setting Value')
                    ->description('Edit runtime values here. Changes apply instantly via cached DB config.')
                    ->schema([
                        TextInput::make('value')
                            ->label('Value')
                            ->hidden(fn (Get $get): bool => (string) $get('type') === 'json' || (bool) $get('is_secret'))
                            ->helperText(function (Get $get): string {
                                return match ((string) $get('type')) {
                                    'bool' => 'Use true or false',
                                    'int' => 'Integer only',
                                    'float' => 'Decimal number (example: 25.5)',
                                    'url' => 'Full URL including http/https',
                                    default => 'Plain text value',
                                };
                            })
                            ->columnSpanFull(),
                        TextInput::make('value')
                            ->label('Secret Value')
                            ->password()
                            ->revealable()
                            ->hidden(fn (Get $get): bool => (string) $get('type') === 'json' || ! (bool) $get('is_secret'))
                            ->helperText('Hidden by default. Use the reveal button only when needed.')
                            ->columnSpanFull(),
                        Textarea::make('value')
                            ->label('JSON Value')
                            ->rows(8)
                            ->hidden(fn (Get $get): bool => (string) $get('type') !== 'json')
                            ->helperText('Provide valid JSON object/array only.')
                            ->placeholder("{\n  \"key\": \"value\"\n}")
                            ->columnSpanFull(),
                    ])
                    ->columns(1),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(
                fn ($query) => $query
                    ->whereNotIn('module', static::hiddenModules())
                    ->orderBy('module')
                    ->orderBy('label')
            )
            ->columns([
                TextColumn::make('module')
                    ->badge()
                    ->color(fn (string $state): string => SystemSetting::moduleColor($state))
                    ->sortable(),
                TextColumn::make('key')
                    ->searchable()
                    ->copyable()
                    ->fontFamily(FontFamily::Mono),
                TextColumn::make('label')
                    ->searchable()
                    ->description(fn (SystemSetting $record): ?string => $record->description)
                    ->toggleable(),
                TextColumn::make('type')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'bool' => 'success',
                        'int', 'float' => 'info',
                        'json' => 'warning',
                        'url' => 'primary',
                        default => 'gray',
                    }),
                IconColumn::make('is_secret')
                    ->label('Secret')
                    ->boolean(),
                TextColumn::make('status')
                    ->label('Status')
                    ->state(fn (SystemSetting $record): string => $record->value === null ? 'Missing' : 'Configured')
                    ->badge()
                    ->color(fn (string $state): string => $state === 'Configured' ? 'success' : 'danger'),
                TextColumn::make('value_preview')
                    ->label('Current value')
                    ->state(fn (SystemSetting $record): string => $record->valuePreview())
                    ->color(fn (string $state): string => $state === '-' ? 'danger' : 'gray')
                    ->toggleable(),
                TextColumn::make('updatedBy.email')
                    ->label('Updated by')
                    ->toggleable(),
                TextColumn::make('updated_at')
                    ->dateTime('Y-m-d H:i')
                    ->since()
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('module')
                    ->options(static::visibleModuleOptions()),
                SelectFilter::make('type')
                    ->options(SystemSetting::typeOptions()),
                TernaryFilter::make('is_secret')
                    ->label('Secret only'),
                TernaryFilter::make('value')
                    ->label('Configured')
                    ->nullable()
                    ->trueLabel('Configured')
                    ->falseLabel('Missing'),
            ])
            ->filtersLayout(FiltersLayout::AboveContentCollapsible)
            ->filtersFormColumns(4)
            ->deferFilters()
            ->groups([
                Group::make('module')
                    ->label('Module')
                    ->collapsible(),
            ])
            ->defaultGroup('module')
            ->groupingSettingsInDropdownOnDesktop()
            ->recordActions([
                ActionGroup::make([
                    EditAction::make()
                        ->label('Edit Value'),
                    Action::make('reset_default')
                        ->label('Reset Default')
                        ->icon('heroicon-o-arrow-path')
                        ->color('gray')
                        ->requiresConfirmation()
                        ->visible(fn (SystemSetting $record): bool => SystemSetting::definitionForKey((string) $record->key) !== null)
                        ->action(function (SystemSetting $record): void {
                            $definition = SystemSetting::definitionForKey((string) $record->key);
                            if (! is_array($definition)) {
                                return;
                            }

                            $record->forceFill([
                                'value' => $definition['default_value'],
                            ])->save();
                        })
                        ->successNotificationTitle('Setting reset to default value.'),
                ])
                    ->label('Actions')
                    ->icon('heroicon-o-ellipsis-horizontal'),
            ])
            ->toolbarActions([])
            ->emptyStateIcon('heroicon-o-cog-6-tooth')
            ->emptyStateHeading('No visible core settings')
            ->emptyStateDescription('Provider modules are managed in their dedicated setup pages.');
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function canDeleteAny(): bool
    {
        return false;
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageSystemSettings::route('/'),
        ];
    }

    public static function getNavigationBadge(): ?string
    {
        $visibleModules = static::visibleModuleKeys();

        $total = collect(SystemSetting::defaultDefinitions())
            ->filter(fn (array $definition): bool => in_array((string) ($definition['module'] ?? ''), $visibleModules, true))
            ->count();

        if ($total === 0) {
            return null;
        }

        $configured = SystemSetting::query()
            ->whereIn('module', $visibleModules)
            ->whereNotNull('value')
            ->count();

        $missing = max($total - $configured, 0);

        return $missing > 0
            ? (string) $missing
            : null;
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Visible runtime keys without configured value.';
    }

    public static function getNavigationBadgeColor(): string|array|null
    {
        return 'warning';
    }

    /**
     * @return array<int, string>
     */
    public static function hiddenModules(): array
    {
        return self::HIDDEN_MODULES;
    }

    /**
     * @return array<string, string>
     */
    public static function visibleModuleOptions(): array
    {
        return array_filter(
            SystemSetting::moduleOptions(),
            fn (string $module): bool => ! in_array($module, static::hiddenModules(), true),
            ARRAY_FILTER_USE_KEY
        );
    }

    /**
     * @return array<int, string>
     */
    public static function visibleModuleKeys(): array
    {
        return array_keys(static::visibleModuleOptions());
    }
}
