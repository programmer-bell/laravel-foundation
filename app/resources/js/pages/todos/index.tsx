import { Form, Head, router, useForm } from '@inertiajs/react';
import {
    CalendarClock,
    Check,
    CheckCircle2,
    Circle,
    Clock3,
    GripVertical,
    Pencil,
    RefreshCw,
    Trash2,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type DragEvent, type KeyboardEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { TodoStatus, type TodoStatusOption } from '@/enums/todo-status';
import { cn } from '@/lib/utils';
import { destroy, index, store, update } from '@/routes/todos';

type Todo = {
    id: number;
    title: string;
    status: TodoStatus;
};

const statusMeta: Record<TodoStatus, { icon: LucideIcon; tone: string }> = {
    [TodoStatus.Pending]: {
        icon: Circle,
        tone: 'text-slate-500 dark:text-slate-400',
    },
    [TodoStatus.InProgress]: {
        icon: Clock3,
        tone: 'text-blue-600 dark:text-blue-400',
    },
    [TodoStatus.Postponed]: {
        icon: CalendarClock,
        tone: 'text-amber-600 dark:text-amber-400',
    },
    [TodoStatus.Completed]: {
        icon: CheckCircle2,
        tone: 'text-emerald-600 dark:text-emerald-400',
    },
};

const fallbackLabels: Record<TodoStatus, string> = {
    [TodoStatus.Pending]: 'Pending',
    [TodoStatus.InProgress]: 'In Progress',
    [TodoStatus.Postponed]: 'Postponed',
    [TodoStatus.Completed]: 'Completed',
};

export default function TodosIndex({
    todos,
    statuses,
}: {
    todos: Todo[];
    statuses: TodoStatusOption[];
}) {
    // Local copy so a drop feels instant while the PATCH is in flight.
    const [board, setBoard] = useState<Todo[]>(todos);
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [overStatus, setOverStatus] = useState<TodoStatus | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const editForm = useForm<{ title: string }>({ title: '' });

    // Inertia sends a fresh `todos` prop after create/edit/delete/move.
    useEffect(() => setBoard(todos), [todos]);

    const statusOrder = statuses.length
        ? statuses.map((option) => option.value)
        : Object.values(TodoStatus);

    const labelFor = (status: TodoStatus) =>
        statuses.find((option) => option.value === status)?.label ??
        fallbackLabels[status];

    // GET — ask Laravel for a fresh list. Inertia re-renders this page with
    // new `todos` props without a full browser reload.
    const refresh = () => router.reload({});

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

    // PATCH — a drop (or arrow key) changes only the status enum value.
    const moveTodo = (todo: Todo, status: TodoStatus) => {
        if (todo.status === status) {
            return;
        }

        const previousBoard = board;
        setBoard((current) =>
            current.map((item) =>
                item.id === todo.id ? { ...item, status } : item,
            ),
        );

        router.patch(
            update(todo.id),
            { status },
            {
                preserveScroll: true,
                onError: () => {
                    setBoard(previousBoard);
                    router.reload({ only: ['todos'] });
                },
            },
        );
    };

    const handleDragOver = (
        event: DragEvent<HTMLElement>,
        status: TodoStatus,
    ) => {
        if (draggingId === null) {
            return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        if (overStatus !== status) {
            setOverStatus(status);
        }
    };

    const handleDragLeave = (
        event: DragEvent<HTMLElement>,
        status: TodoStatus,
    ) => {
        // Ignore moves between the column and its children.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return;
        }

        setOverStatus((current) => (current === status ? null : current));
    };

    const handleDrop = (event: DragEvent<HTMLElement>, status: TodoStatus) => {
        event.preventDefault();
        setOverStatus(null);
        setDraggingId(null);

        const id = Number(event.dataTransfer.getData('text/plain'));
        const todo = board.find((item) => item.id === id);

        if (todo) {
            moveTodo(todo, status);
        }
    };

    // Keyboard fallback: focus a card and use ← / → to move it between columns.
    const handleCardKeyDown = (
        event: KeyboardEvent<HTMLDivElement>,
        todo: Todo,
    ) => {
        if (event.target !== event.currentTarget) {
            return;
        }

        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
            return;
        }

        event.preventDefault();

        const currentIndex = statusOrder.indexOf(todo.status);
        const nextStatus =
            statusOrder[currentIndex + (event.key === 'ArrowRight' ? 1 : -1)];

        if (nextStatus) {
            moveTodo(todo, nextStatus);
        }
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

            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold">Todos</h1>
                        <p className="text-xs text-muted-foreground">
                            Drag a card between columns to update its status.
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Refresh todos"
                        onClick={refresh}
                    >
                        <RefreshCw />
                    </Button>
                </div>

                {/* POST /todos — new todos start in Pending */}
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

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {statusOrder.map((status) => {
                        const items = board.filter(
                            (todo) => todo.status === status,
                        );
                        const { icon: Icon, tone } = statusMeta[status];
                        const isTarget = overStatus === status;

                        return (
                            <section
                                key={status}
                                aria-label={`${labelFor(status)} column`}
                                onDragOver={(event) =>
                                    handleDragOver(event, status)
                                }
                                onDragLeave={(event) =>
                                    handleDragLeave(event, status)
                                }
                                onDrop={(event) => handleDrop(event, status)}
                                className={cn(
                                    'flex min-h-72 flex-col rounded-xl border bg-muted/25 p-3 transition-colors',
                                    draggingId !== null && 'border-dashed',
                                    isTarget &&
                                        'border-primary bg-primary/5 ring-2 ring-primary/20',
                                )}
                            >
                                <header className="mb-3 flex items-center gap-2">
                                    <Icon
                                        className={cn('size-4', tone)}
                                        aria-hidden="true"
                                    />
                                    <h2 className="text-sm font-semibold">
                                        {labelFor(status)}
                                    </h2>
                                    <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                                        {items.length}
                                    </span>
                                </header>

                                <div className="flex flex-1 flex-col gap-2">
                                    {items.length === 0 ? (
                                        <div
                                            className={cn(
                                                'flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground',
                                                isTarget &&
                                                    'border-primary text-primary',
                                            )}
                                        >
                                            Drop todos here
                                        </div>
                                    ) : (
                                        items.map((todo) => (
                                            <div
                                                key={todo.id}
                                                draggable={
                                                    editingId !== todo.id
                                                }
                                                tabIndex={0}
                                                aria-label={`${todo.title}, ${labelFor(todo.status)}. Use left and right arrow keys to change status.`}
                                                onDragStart={(event) => {
                                                    event.dataTransfer.setData(
                                                        'text/plain',
                                                        String(todo.id),
                                                    );
                                                    event.dataTransfer.effectAllowed =
                                                        'move';
                                                    setDraggingId(todo.id);
                                                }}
                                                onDragEnd={() => {
                                                    setDraggingId(null);
                                                    setOverStatus(null);
                                                }}
                                                onKeyDown={(event) =>
                                                    handleCardKeyDown(
                                                        event,
                                                        todo,
                                                    )
                                                }
                                                className={cn(
                                                    'group flex items-start gap-2 rounded-lg border bg-background p-2.5 text-sm shadow-xs transition-all',
                                                    'hover:border-foreground/20 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                                    draggingId === todo.id &&
                                                        'opacity-40',
                                                    editingId === todo.id &&
                                                        'cursor-default',
                                                )}
                                            >
                                                <GripVertical
                                                    className="mt-0.5 size-4 shrink-0 text-muted-foreground/60"
                                                    aria-hidden="true"
                                                />

                                                {editingId === todo.id ? (
                                                    <div className="grid min-w-0 flex-1 gap-2">
                                                        <Input
                                                            value={
                                                                editForm.data
                                                                    .title
                                                            }
                                                            onChange={(event) =>
                                                                editForm.setData(
                                                                    'title',
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                            onKeyDown={(
                                                                event,
                                                            ) => {
                                                                if (
                                                                    event.key ===
                                                                    'Enter'
                                                                ) {
                                                                    event.preventDefault();
                                                                    saveTitle(
                                                                        todo,
                                                                    );
                                                                }
                                                                if (
                                                                    event.key ===
                                                                    'Escape'
                                                                ) {
                                                                    cancelEditing();
                                                                }
                                                            }}
                                                            className="h-8"
                                                            autoFocus
                                                            aria-label="Todo title"
                                                        />
                                                        <InputError
                                                            message={
                                                                editForm.errors
                                                                    .title
                                                            }
                                                        />
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-7"
                                                                aria-label="Save title"
                                                                onClick={() =>
                                                                    saveTitle(
                                                                        todo,
                                                                    )
                                                                }
                                                                disabled={
                                                                    editForm.processing
                                                                }
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
                                                                className="size-7"
                                                                aria-label="Cancel edit"
                                                                onClick={
                                                                    cancelEditing
                                                                }
                                                            >
                                                                <X />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span
                                                            className={cn(
                                                                'min-w-0 flex-1 break-words',
                                                                todo.status ===
                                                                    TodoStatus.Completed &&
                                                                    'text-muted-foreground line-through',
                                                            )}
                                                        >
                                                            {todo.title}
                                                        </span>
                                                        <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-7"
                                                                aria-label={`Edit ${todo.title}`}
                                                                onClick={() =>
                                                                    startEditing(
                                                                        todo,
                                                                    )
                                                                }
                                                            >
                                                                <Pencil className="size-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-7"
                                                                aria-label={`Delete ${todo.title}`}
                                                                onClick={() =>
                                                                    handleDelete(
                                                                        todo,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 className="size-3.5" />
                                                            </Button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </>
    );
}

TodosIndex.layout = {
    breadcrumbs: [{ title: 'Todos', href: index() }],
};
