<?php

namespace App\Filament\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

trait HasPanelRoleAuthorization
{
    public static function canViewAny(): bool
    {
        return static::panelRoleAllowed(static::getViewAnyRoles());
    }

    public static function canCreate(): bool
    {
        $roles = static::getCreateRoles();
        if ($roles === []) {
            return false;
        }

        return static::panelRoleAllowed($roles);
    }

    public static function canEdit(Model $record): bool
    {
        $roles = static::getEditRoles();
        if ($roles === []) {
            return false;
        }

        return static::panelRoleAllowed($roles);
    }

    public static function canDelete(Model $record): bool
    {
        $roles = static::getDeleteRoles();
        if ($roles === []) {
            return false;
        }

        return static::panelRoleAllowed($roles);
    }

    public static function canDeleteAny(): bool
    {
        $roles = static::getDeleteRoles();
        if ($roles === []) {
            return false;
        }

        return static::panelRoleAllowed($roles);
    }

    /**
     * @param  array<int, string>  $roles
     */
    protected static function panelRoleAllowed(array $roles): bool
    {
        $user = auth()->user();

        return $user instanceof User
            && $user->hasAnyPanelRole($roles);
    }

    /**
     * @return array<int, string>
     */
    protected static function getViewAnyRoles(): array
    {
        return static::resolveRolesProperty('viewAnyRoles');
    }

    /**
     * @return array<int, string>
     */
    protected static function getCreateRoles(): array
    {
        return static::resolveRolesProperty('createRoles');
    }

    /**
     * @return array<int, string>
     */
    protected static function getEditRoles(): array
    {
        return static::resolveRolesProperty('editRoles');
    }

    /**
     * @return array<int, string>
     */
    protected static function getDeleteRoles(): array
    {
        return static::resolveRolesProperty('deleteRoles');
    }

    /**
     * @return array<int, string>
     */
    protected static function resolveRolesProperty(string $property): array
    {
        if (property_exists(static::class, $property)) {
            $value = static::${$property};

            if (is_array($value)) {
                return $value;
            }
        }

        return [User::ADMIN_ROLE_SUPER_ADMIN];
    }
}
