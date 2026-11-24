<?php

namespace App\Http\Controllers;

use App\Enums\TodoStatus;
use App\Models\Todo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TodoController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('todos/index', [
            'todos' => $request->user()
                ->todos()
                // Keep pending work first, then in-progress, postponed, done.
                ->orderByRaw(
                    'CASE status WHEN ? THEN 0 WHEN ? THEN 1 WHEN ? THEN 2 WHEN ? THEN 3 ELSE 4 END',
                    array_map(fn (TodoStatus $status) => $status->value, TodoStatus::cases()),
                )
                ->latest()
                ->get(['id', 'title', 'status']),
            'statuses' => TodoStatus::options(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'status' => ['sometimes', Rule::enum(TodoStatus::class)],
        ]);

        $request->user()->todos()->create($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Todo added.')]);

        return to_route('todos.index');
    }

    public function update(Request $request, Todo $todo): RedirectResponse
    {
        Gate::authorize('update', $todo);

        // Both fields are optional so the browser can send a partial update
        // (PATCH just `status`) or a title edit (PUT just `title`).
        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'status' => ['sometimes', Rule::enum(TodoStatus::class)],
        ]);

        $todo->update($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Todo updated.')]);

        return back();
    }

    public function destroy(Todo $todo): RedirectResponse
    {
        Gate::authorize('delete', $todo);

        $todo->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Todo deleted.')]);

        return to_route('todos.index');
    }
}