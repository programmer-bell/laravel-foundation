import { Form, Head, router, useForm } from '@inertiajs/react';
import { Check, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { destroy, index, store, update } from '@/routes/todos';

type Todo = {
    id: number;
    title: string;
    completed: boolean;
};

export default function TodosIndex({ todos }: { todos: Todo[] }) {
    const [editingId, setEditingId] = useState<number | null>(null);
    const editForm = useForm<{ title: string }>({ title: '' });

    // GET — ask Laravel for a fresh list. Inertia re-renders this page with
    // new `todos` props without a full browser reload.
    const refresh = () => router.reload();

    // POST — the <Form {...store.form()}> below submits to /todos.

    // PUT — edit a single title. Only one row is editable at a time, so one
    // shared form is enough. The route accepts both PUT and PATCH.
    const startEditing = (todo: Todo) => {
        setEditingId(todo.id);
        editForm.setData('title', todo.title);
        editForm.clearErrors();
    };

    const saveTitle = (todo: Todo) => {
        editForm.put(update(todo.id).url, {
            preserveScroll: true,
            onSuccess: () => {
                setEditingId(null);
                editForm.reset();
            },
        });
    };

    const cancelEditing = () => {
        setEditingId(null);
        editForm.reset();
        editForm.clearErrors();
    };

    // PATCH — change only the completed flag. This works in both directions
    // now that `completed` is no longer `required` in the controller.
    const toggleCompleted = (
        todo: Todo,
        checked: boolean | 'indeterminate',
    ) => {
        router.patch(
            update(todo.id),
            { completed: checked === true },
            { preserveScroll: true },
        );
    };

    // DELETE — remove the row after confirmation.
    const handleDelete = (todo: Todo) => {
        if (!window.confirm(`Delete "${todo.title}"?`)) {
            return;
        }

        router.delete(destroy(todo.id), { preserveScroll: true });
    };

    return (
        <>
            <Head title="Todos" />

            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold">Todos</h1>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Refresh todos"
                        onClick={refresh}
                    >
                        <RefreshCw />
                    </Button>
                </div>

                {/* POST /todos — Inertia's Form handles CSRF and errors */}
                <Form {...store.form()} resetOnSuccess className="flex gap-2">
                    {({ processing, errors }) => (
                        <>
                            <div className="grid flex-1 gap-2">
                                <Input
                                    name="title"
                                    placeholder="What needs doing?"
                                    autoFocus
                                    required
                                />
                                <InputError message={errors.title} />
                            </div>
                            <Button type="submit" disabled={processing}>
                                {processing && <Spinner />}
                                Add
                            </Button>
                        </>
                    )}
                </Form>

                {todos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No todos yet. Add your first one above.
                    </p>
                ) : (
                    <ul className="divide-y rounded-lg border">
                        {todos.map((todo) => (
                            <li
                                key={todo.id}
                                className="flex items-center gap-3 p-3"
                            >
                                <Checkbox
                                    checked={todo.completed}
                                    onCheckedChange={(checked) =>
                                        toggleCompleted(todo, checked)
                                    }
                                    aria-label={
                                        todo.completed
                                            ? `Mark ${todo.title} as not done`
                                            : `Mark ${todo.title} as done`
                                    }
                                />

                                {editingId === todo.id ? (
                                    <div className="grid flex-1 gap-1">
                                        <Input
                                            value={editForm.data.title}
                                            onChange={(event) =>
                                                editForm.setData(
                                                    'title',
                                                    event.target.value,
                                                )
                                            }
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    saveTitle(todo);
                                                }
                                                if (event.key === 'Escape') {
                                                    cancelEditing();
                                                }
                                            }}
                                            autoFocus
                                            aria-label="Todo title"
                                        />
                                        <InputError
                                            message={editForm.errors.title}
                                        />
                                    </div>
                                ) : (
                                    <span
                                        className={
                                            todo.completed
                                                ? 'flex-1 text-muted-foreground line-through'
                                                : 'flex-1'
                                        }
                                    >
                                        {todo.title}
                                    </span>
                                )}

                                {editingId === todo.id ? (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Save title"
                                            onClick={() => saveTitle(todo)}
                                            disabled={editForm.processing}
                                        >
                                            {editForm.processing ? (
                                                <Spinner />
                                            ) : (
                                                <Check />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Cancel edit"
                                            onClick={cancelEditing}
                                        >
                                            <X />
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Edit ${todo.title}`}
                                        onClick={() => startEditing(todo)}
                                    >
                                        <Pencil />
                                    </Button>
                                )}

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Delete ${todo.title}`}
                                    onClick={() => handleDelete(todo)}
                                >
                                    <Trash2 />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}

TodosIndex.layout = {
    breadcrumbs: [{ title: 'Todos', href: index() }],
};
