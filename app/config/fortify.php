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
