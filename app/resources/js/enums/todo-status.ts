// Mirror of App\Enums\TodoStatus (app/app/Enums/TodoStatus.php).
export enum TodoStatus {
    Pending = 'pending',
    InProgress = 'in_progress',
    Postponed = 'postponed',
    Completed = 'completed',
}

export type TodoStatusOption = {
    value: TodoStatus;
    label: string;
};
