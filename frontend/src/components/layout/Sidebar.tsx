import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, FileCheck, Users, PanelLeft, LogOut, Shield } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import logoUrl from '../../assets/logo.svg';

const navItems = [
    { icon: Home, label: 'Home', to: '/dashboard' },
    { icon: FileCheck, label: 'Deliberations', to: '/deliberate' },
    { icon: Users, label: 'Candidates', to: '/data' },
];

function getInitials(name?: string | null, email?: string | null): string {
    if (name) {
        const parts = name.split(' ').filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return parts[0]?.slice(0, 2).toUpperCase() ?? '??';
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return '??';
}

function getDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string } | null): string {
    if (!user) return 'Unknown';
    const meta = user.user_metadata;
    if (meta?.full_name && typeof meta.full_name === 'string') return meta.full_name;
    if (meta?.name && typeof meta.name === 'string') return meta.name;
    return user.email ?? 'Unknown';
}

export function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const { user, role, signOut } = useAuth();

    const displayName = getDisplayName(user);
    const initials = getInitials(
        user?.user_metadata?.full_name as string | undefined,
        user?.email,
    );

    return (
        <div className={cn("border-r border-border bg-surface h-screen flex flex-col transition-all duration-300", isCollapsed ? "w-16" : "w-52")}>
            <div className={cn("h-16 flex items-center gap-2 px-4 border-b border-border", isCollapsed ? "justify-center" : "justify-between")}>
                {isCollapsed ? (
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="p-1 rounded-md hover:bg-surfaceHover transition-colors flex items-center justify-center"
                        title="Expand sidebar"
                    >
                        <img src={logoUrl} alt="HSYLC" className="w-9 h-9 shrink-0 object-contain" />
                    </button>
                ) : (
                    <>
                        <img src={logoUrl} alt="HSYLC" className="w-9 h-9 shrink-0 object-contain" />
                        {/* <span className="font-semibold text-sm tracking-tight text-primary truncate font-display">HAUSCR Tech</span> */}
                        <button
                            onClick={() => setIsCollapsed(true)}
                            className="p-1 rounded-md text-secondary hover:text-primary hover:bg-surfaceHover transition-colors"
                        >
                            <PanelLeft className="w-5 h-5" />
                        </button>
                    </>
                )}
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

            <div className="px-3 pb-3">
                {role === 'admin' && (
                    <NavLink
                        to="/admin/users"
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150",
                                isActive
                                    ? "bg-accent/10 text-accent dark:bg-accent/20"
                                    : "text-secondary hover:text-primary hover:bg-surfaceHover",
                                isCollapsed ? "justify-center" : "justify-start"
                            )
                        }
                        title={isCollapsed ? "Admin" : undefined}
                    >
                        <Shield className="w-5 h-5 shrink-0" />
                        {!isCollapsed && <span className="text-sm font-medium truncate">Admin</span>}
                    </NavLink>
                )}
            </div>
            <div className="p-4 border-t border-border relative">
                <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className={cn(
                        "w-full flex items-center p-1.5 -m-1.5 rounded-md hover:bg-surfaceHover transition-colors focus:outline-none",
                        isCollapsed ? "justify-center" : "gap-3"
                    )}
                >
                    <div className="w-8 h-8 shrink-0 rounded-full bg-accent text-white flex items-center justify-center font-semibold text-xs">
                        {initials}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-medium text-primary truncate">{displayName}</div>
                            {role && (
                                <div className="text-[11px] text-secondary capitalize">{role}</div>
                            )}
                        </div>
                    )}
                </button>

                {isUserMenuOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsUserMenuOpen(false)}
                        />
                        <div className={cn(
                            "absolute bottom-full mb-2 bg-surface text-primary border border-border rounded-md shadow-md py-1 z-50",
                            isCollapsed ? "left-2 w-48" : "left-4 right-4"
                        )}>
                            <button
                                onClick={() => {
                                    setIsUserMenuOpen(false);
                                    signOut();
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surfaceHover transition-colors text-left"
                            >
                                <LogOut className="w-4 h-4 shrink-0" />
                                <span>Sign out</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
