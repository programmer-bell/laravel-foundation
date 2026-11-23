#!/usr/bin/env bash
# Lean-auth cleanup for laravel-foundation.
# Run from the PROJECT ROOT (the folder that contains Dockerfile and app/).
# Keeps: register, login, logout, dashboard, welcome. Removes everything else
# the starter kit added (2FA, passkeys, email verification, password reset,
# settings pages, Boost/AI tooling, CI, static analysis, example tests).
set -euo pipefail

[ -f app/artisan ] || { echo "Run this from the project root (app/artisan not found)."; exit 1; }
cd app

echo "==> 1/5 Deleting files and folders"
rm -rf \
  .github .agents .claude .cursor .junie .mcp.json boost.json AGENTS.md CLAUDE.md GEMINI.md \
  phpstan.neon pnpm-workspace.yaml \
  routes/settings.php \
  app/Http/Controllers/Settings app/Http/Requests/Settings \
  app/Actions/Fortify/ResetUserPassword.php \
  database/migrations/2024_01_01_000000_create_passkeys_table.php \
  database/migrations/2025_08_14_170933_add_two_factor_columns_to_users_table.php \
  resources/js/components/{alert-error,app-header,appearance-tabs,delete-user,manage-passkeys,manage-two-factor,nav-footer,passkey-item,passkey-register,passkey-verify,two-factor-recovery-codes,two-factor-setup-modal}.tsx \
  resources/js/components/ui/input-otp.tsx \
  resources/js/hooks/{use-two-factor-auth.ts,use-clipboard.ts} \
  resources/js/layouts/settings resources/js/layouts/app/app-header-layout.tsx \
  resources/js/layouts/auth/auth-card-layout.tsx resources/js/layouts/auth/auth-split-layout.tsx \
  resources/js/pages/settings \
  resources/js/pages/auth/{forgot-password,reset-password,two-factor-challenge,verify-email,confirm-password}.tsx \
  tests/Feature/Settings tests/Unit tests/Feature/ExampleTest.php \
  tests/Feature/Auth/{EmailVerificationTest,PasswordConfirmationTest,PasswordResetTest,TwoFactorChallengeTest,VerificationNotificationTest}.php

echo "==> 2/5 Rewriting backend files"

cat > app/Models/User.php <<'PHP'
<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

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
        ];
    }
}
PHP

cat > app/Providers/FortifyServiceProvider.php <<'PHP'
<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Which class creates a user when the register form is submitted.
        Fortify::createUsersUsing(CreateNewUser::class);

        // Which React page Fortify shows for GET /login and GET /register.
        Fortify::loginView(fn (Request $request) => Inertia::render('auth/login', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::registerView(fn () => Inertia::render('auth/register', [
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]));

        // Throttle login attempts: 5 per minute per email + IP.
        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });
    }
}
PHP

cat > config/fortify.php <<'PHP'
<?php

use Laravel\Fortify\Features;

return [

    // Auth guard and password broker Fortify uses.
    'guard' => 'web',
    'passwords' => 'users',

    // Which column identifies a user.
    'username' => 'email',
    'email' => 'email',
    'lowercase_usernames' => true,

    // Where to redirect after login / register.
    'home' => '/dashboard',

    // Route prefix, subdomain and middleware for Fortify's routes.
    'prefix' => '',
    'domain' => null,
    'middleware' => ['web'],

    // Named rate limiters (defined in FortifyServiceProvider).
    'limiters' => [
        'login' => 'login',
    ],

    // Fortify serves its GET pages (login, register) through our React pages.
    'views' => true,

    // Only registration is enabled. Login/logout are always on.
    'features' => [
        Features::registration(),
    ],

];
PHP

cat > routes/web.php <<'PHP'
<?php

use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware('auth')->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
});
PHP

cat > database/factories/UserFactory.php <<'PHP'
<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }
}
PHP

# Drop the two-factor test + its import from AuthenticationTest.
perl -0pi -e "s/use Laravel\\\\Fortify\\\\Features;\n//; s/test\('users with two factor enabled.*?\n\}\);\n\n//s" tests/Feature/Auth/AuthenticationTest.php

echo "==> 3/5 Rewriting frontend files"

cat > resources/js/app.tsx <<'TSX'
import { createInertiaApp } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

void createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    // Decides which persistent layout wraps each page, by page name.
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
                return null;
            case name.startsWith('auth/'):
                return AuthLayout;
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
TSX

cat > resources/js/types/auth.ts <<'TS'
export type User = {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User;
};
TS

cat > resources/js/components/app-sidebar.tsx <<'TSX'
import { Link } from '@inertiajs/react';
import { LayoutGrid } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
TSX

cat > resources/js/components/user-menu-content.tsx <<'TSX'
import { Link, router } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import {
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { logout } from '@/routes';
import type { User } from '@/types';

type Props = {
    user: User;
};

export function UserMenuContent({ user }: Props) {
    const cleanup = useMobileNavigation();

    const handleLogout = () => {
        cleanup();
        router.flushAll();
    };

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={user} showEmail={true} />
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <Link
                    className="block w-full cursor-pointer"
                    href={logout()}
                    as="button"
                    onClick={handleLogout}
                    data-test="logout-button"
                >
                    <LogOut className="mr-2" />
                    Log out
                </Link>
            </DropdownMenuItem>
        </>
    );
}
TSX

cat > resources/js/pages/auth/login.tsx <<'TSX'
import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { register } from '@/routes';
import { store } from '@/routes/login';

type Props = {
    status?: string;
};

export default function Login({ status }: Props) {
    return (
        <>
            <Head title="Log in" />

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder="email@example.com"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password">Password</Label>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder="Password"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    tabIndex={3}
                                />
                                <Label htmlFor="remember">Remember me</Label>
                            </div>

                            <Button
                                type="submit"
                                className="mt-4 w-full"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                Log in
                            </Button>
                        </div>

                        <div className="text-center text-sm text-muted-foreground">
                            Don't have an account?{' '}
                            <TextLink href={register()} tabIndex={5}>
                                Sign up
                            </TextLink>
                        </div>
                    </>
                )}
            </Form>

            {status && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
                    {status}
                </div>
            )}
        </>
    );
}

Login.layout = {
    title: 'Log in to your account',
    description: 'Enter your email and password below to log in',
};
TSX

cat > resources/js/pages/welcome.tsx <<'TSX'
import { Head, Link, usePage } from '@inertiajs/react';
import { dashboard, login, register } from '@/routes';

export default function Welcome() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Welcome" />
            <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
                <h1 className="text-3xl font-semibold">Todo App</h1>
                <nav className="flex gap-3 text-sm">
                    {auth.user ? (
                        <Link
                            href={dashboard()}
                            className="rounded-md border px-4 py-2"
                        >
                            Dashboard
                        </Link>
                    ) : (
                        <>
                            <Link
                                href={login()}
                                className="rounded-md border px-4 py-2"
                            >
                                Log in
                            </Link>
                            <Link
                                href={register()}
                                className="rounded-md border px-4 py-2"
                            >
                                Register
                            </Link>
                        </>
                    )}
                </nav>
            </div>
        </>
    );
}
TSX

echo "==> 4/5 Trimming composer.json scripts (Boost / PHPStan hooks)"
perl -0pi -e 's/,\n\s*"\@php artisan boost:update --ansi"//; s/\n\s*"\@types:check",//; s/\n\s*"types:check": \[\s*"phpstan analyse"\s*\],//' composer.json
if grep -q "boost:update\|phpstan\|@types:check" composer.json; then
  echo "!! composer.json still mentions boost/phpstan - edit by hand"; fi

echo "==> 5/5 Done with file edits"
echo
echo "Next (see instructions): composer remove, npm uninstall, migrate:fresh."