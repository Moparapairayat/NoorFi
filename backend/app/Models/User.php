<?php

namespace App\Models;

use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements FilamentUser
{
    public const ADMIN_ROLE_SUPER_ADMIN = 'super_admin';

    public const ADMIN_ROLE_OPERATIONS = 'operations';

    public const ADMIN_ROLE_SUPPORT = 'support';

    public const ADMIN_ROLE_COMPLIANCE = 'compliance';

    public const ADMIN_ROLES = [
        self::ADMIN_ROLE_SUPER_ADMIN,
        self::ADMIN_ROLE_OPERATIONS,
        self::ADMIN_ROLE_SUPPORT,
        self::ADMIN_ROLE_COMPLIANCE,
    ];

    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens;
    use HasFactory;
    use Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'full_name',
        'email',
        'email_verified_at',
        'phone_number',
        'password',
        'transaction_pin',
        'kyc_status',
        'account_status',
        'is_admin',
        'admin_role',
        'last_login_at',
        'strowallet_customer_id',
        'didit_session_id',
        'didit_reference_id',
        'didit_session_url',
        'didit_vendor_status',
        'didit_decision',
        'didit_last_webhook_at',
        'didit_payload',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'transaction_pin',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'transaction_pin' => 'hashed',
            'is_admin' => 'boolean',
            'last_login_at' => 'datetime',
            'didit_last_webhook_at' => 'datetime',
            'didit_payload' => 'array',
        ];
    }

    public function canAccessPanel(Panel $panel): bool
    {
        return $this->resolveAdminRole() !== null;
    }

    public static function adminRoleOptions(): array
    {
        return [
            self::ADMIN_ROLE_SUPER_ADMIN => 'Super Admin',
            self::ADMIN_ROLE_OPERATIONS => 'Operations',
            self::ADMIN_ROLE_SUPPORT => 'Support',
            self::ADMIN_ROLE_COMPLIANCE => 'Compliance',
        ];
    }

    public function resolveAdminRole(): ?string
    {
        if (! $this->is_admin) {
            return null;
        }

        $role = strtolower(trim((string) $this->admin_role));
        if ($role === '') {
            return null;
        }

        return in_array($role, self::ADMIN_ROLES, true)
            ? $role
            : null;
    }

    public function hasPanelRole(string $role): bool
    {
        return $this->hasAnyPanelRole([$role]);
    }

    /**
     * @param  array<int, string>  $roles
     */
    public function hasAnyPanelRole(array $roles): bool
    {
        $currentRole = $this->resolveAdminRole();
        if ($currentRole === null) {
            return false;
        }

        if ($currentRole === self::ADMIN_ROLE_SUPER_ADMIN) {
            return true;
        }

        if ($roles === []) {
            return false;
        }

        $normalizedRoles = array_map(
            fn (string $value): string => strtolower(trim($value)),
            $roles
        );

        return in_array($currentRole, $normalizedRoles, true);
    }

    public function wallets(): HasMany
    {
        return $this->hasMany(Wallet::class);
    }

    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
    }

    public function kycProfile(): HasOne
    {
        return $this->hasOne(KycProfile::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function deposits(): HasMany
    {
        return $this->hasMany(Deposit::class);
    }

    public function transfers(): HasMany
    {
        return $this->hasMany(Transfer::class);
    }

    public function withdrawals(): HasMany
    {
        return $this->hasMany(Withdrawal::class);
    }

    public function exchanges(): HasMany
    {
        return $this->hasMany(Exchange::class);
    }

    public function supportTickets(): HasMany
    {
        return $this->hasMany(SupportTicket::class);
    }

    public function staticWallets(): HasMany
    {
        return $this->hasMany(UserStaticWallet::class);
    }
}
