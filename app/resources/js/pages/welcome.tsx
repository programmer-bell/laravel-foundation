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
