<?php

use App\Models\Todo;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests are redirected to login', function () {
    $this->get(route('todos.index'))->assertRedirect(route('login'));
});

test('users only see their own todos', function () {
    $user = User::factory()->create();
    $mine = Todo::factory()->for($user)->create();
    Todo::factory()->create(); // belongs to someone else

    $this->actingAs($user)
        ->get(route('todos.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('todos/index')
            ->has('todos', 1)
            ->where('todos.0.id', $mine->id));
});

test('users can create a todo', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('todos.store'), ['title' => 'Buy milk'])
        ->assertRedirect(route('todos.index'));

    $this->assertDatabaseHas('todos', [
        'user_id' => $user->id,
        'title' => 'Buy milk',
        'completed' => false,
    ]);
});

test('a title is required', function () {
    $this->actingAs(User::factory()->create())
        ->post(route('todos.store'), ['title' => ''])
        ->assertSessionHasErrors('title');
});

test('users can complete their own todo', function () {
    $todo = Todo::factory()->create();

    $this->actingAs($todo->user)
        ->patch(route('todos.update', $todo), ['completed' => true])
        ->assertRedirect();

    expect($todo->refresh()->completed)->toBeTrue();
});

test('users can uncomplete their own todo', function () {
    // Boolean false used to fail the `required` rule on update.
    $todo = Todo::factory()->create(['completed' => true]);

    $this->actingAs($todo->user)
        ->patch(route('todos.update', $todo), ['completed' => false])
        ->assertRedirect();

    expect($todo->refresh()->completed)->toBeFalse();
});

test('users can rename their own todo', function () {
    $todo = Todo::factory()->create(['title' => 'Old title']);

    $this->actingAs($todo->user)
        ->put(route('todos.update', $todo), ['title' => 'New title'])
        ->assertRedirect();

    expect($todo->refresh()->title)->toBe('New title');
});

test('an updated title cannot be empty', function () {
    $todo = Todo::factory()->create();

    $this->actingAs($todo->user)
        ->put(route('todos.update', $todo), ['title' => ''])
        ->assertSessionHasErrors('title');
});

test('users can delete their own todo', function () {
    $todo = Todo::factory()->create();

    $this->actingAs($todo->user)
        ->delete(route('todos.destroy', $todo))
        ->assertRedirect(route('todos.index'));

    $this->assertModelMissing($todo);
});

test('users cannot change or delete someone else\'s todo', function () {
    $todo = Todo::factory()->create();
    $intruder = User::factory()->create();

    $this->actingAs($intruder)
        ->patch(route('todos.update', $todo), ['completed' => true])
        ->assertForbidden();

    $this->actingAs($intruder)
        ->put(route('todos.update', $todo), ['title' => 'Hacked'])
        ->assertForbidden();

    $this->actingAs($intruder)
        ->delete(route('todos.destroy', $todo))
        ->assertForbidden();

    $this->assertDatabaseHas('todos', [
        'id' => $todo->id,
        'title' => $todo->title,
        'completed' => $todo->completed,
    ]);
});