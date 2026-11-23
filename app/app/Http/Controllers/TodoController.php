<?php

namespace App\Http\Controllers;

use App\Models\Todo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TodoController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('todos/index', [
            'todos' => $request->user()
                ->todos()
                ->orderBy('completed')
                ->latest()
                ->get(['id', 'title', 'completed']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
        ]);

        $request->user()->todos()->create($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Todo added.')]);

        return to_route('todos.index');
    }

    public function update(Request $request, Todo $todo): RedirectResponse
    {
        Gate::authorize('update', $todo);

        // Both fields are optional so the browser can send a partial update
        // (PATCH just `completed`) or a title edit (PUT just `title`).
        // `completed` must not be `required`: Laravel treats boolean false as
        // "empty", so unchecking a todo would fail validation.
        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'completed' => ['sometimes', 'boolean'],
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