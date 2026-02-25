import { NavLink } from 'react-router-dom';
import { Home, Database, CheckSquare } from 'lucide-react';
import { cn } from '../../utils/cn';

const navItems = [
    { icon: Home, label: 'Dashboard', to: '/dashboard' },
    { icon: CheckSquare, label: 'Deliberations', to: '/deliberate' },
    { icon: Database, label: 'Data Base', to: '/data' },
];

export function Sidebar() {
    return (
        <div className="w-64 border-r border-border bg-surface h-screen flex flex-col">
            <div className="h-16 flex items-center px-6 border-b border-border">
                <span className="font-semibold text-lg tracking-tight text-primary">HSYLC System</span>
            </div>
            <div className="flex-1 py-6 px-3 flex flex-col gap-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150",
                                isActive
                                    ? "bg-accent/10 text-accent dark:bg-accent/20"
                                    : "text-secondary hover:text-primary hover:bg-surfaceHover"
                            )
                        }
                    >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                    </NavLink>
                ))}
            </div>
            <div className="p-4 border-t border-border">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-semibold text-xs">
                        AZ
                    </div>
                    <div className="text-sm font-medium text-primary">Admin User</div>
                </div>
            </div>
        </div>
    );
}
