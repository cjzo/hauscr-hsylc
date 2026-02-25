
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
    return (
        <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-accent/20 selection:text-accent">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-[1600px] w-full mx-auto p-4 md:p-8 h-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
