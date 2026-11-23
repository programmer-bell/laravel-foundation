<?php

use App\Http\Controllers\TodoController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware('auth')->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
    Route::resource('todos', TodoController::class)->only(['index', 'store', 'update', 'destroy']);
});