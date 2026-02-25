import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Database, CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

const navItems = [
    { icon: Home, label: 'Dashboard', to: '/dashboard' },
    { icon: CheckSquare, label: 'Deliberations', to: '/deliberate' },
    { icon: Database, label: 'Data Base', to: '/data' },
];

export function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className={cn("border-r border-border bg-surface h-screen flex flex-col transition-all duration-300", isCollapsed ? "w-16" : "w-64")}>
            <div className={cn("h-16 flex items-center px-4 border-b border-border", isCollapsed ? "justify-center" : "justify-between")}>
                {!isCollapsed && <span className="font-semibold text-lg tracking-tight text-primary truncate">HSYLC System</span>}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1 rounded-md text-secondary hover:text-primary hover:bg-surfaceHover transition-colors"
                >
                    {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
            </div>
            <div className="flex-1 py-6 px-3 flex flex-col gap-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150",
                                isActive
                                    ? "bg-accent/10 text-accent dark:bg-accent/20"
                                    : "text-secondary hover:text-primary hover:bg-surfaceHover",
                                isCollapsed ? "justify-center" : "justify-start"
                            )
                        }
                        title={isCollapsed ? item.label : undefined}
                    >
                        <item.icon className="w-5 h-5 shrink-0" />
                        {!isCollapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
                    </NavLink>
                ))}
            </div>
            <div className="p-4 border-t border-border">
                <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
                    <div className="w-8 h-8 shrink-0 rounded-full bg-accent text-white flex items-center justify-center font-semibold text-xs">
                        AZ
                    </div>
                    {!isCollapsed && <div className="text-sm font-medium text-primary truncate">Admin User</div>}
                </div>
            </div>
        </div>
    );
}
