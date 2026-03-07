import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface TierOption {
    value: string;
    label: string;
}

const TIER_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
    auto_accept: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/30',
        text: 'text-emerald-700 dark:text-emerald-300',
        dot: 'bg-emerald-500',
    },
    tier_1: {
        bg: 'bg-blue-50 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-300',
        dot: 'bg-blue-500',
    },
    tier_2: {
        bg: 'bg-violet-50 dark:bg-violet-900/30',
        text: 'text-violet-700 dark:text-violet-300',
        dot: 'bg-violet-500',
    },
    tier_3: {
        bg: 'bg-amber-50 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500',
    },
    tier_4: {
        bg: 'bg-red-50 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300',
        dot: 'bg-red-500',
    },
};

interface TierSelectProps {
    options: readonly TierOption[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    size?: 'sm' | 'md';
}

export function TierSelect({ options, value, onChange, disabled = false, size = 'sm' }: TierSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number; minWidth: number }>({ top: 0, left: 0, minWidth: 0 });

    const selectedOption = options.find((o) => o.value === value);
    const colors = value ? TIER_COLOR[value] : null;

    const recompute = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setPos({ top: rect.bottom + 4, left: rect.left, minWidth: Math.max(rect.width, 160) });
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        recompute();
        window.addEventListener('scroll', recompute, true);
        window.addEventListener('resize', recompute);
        return () => {
            window.removeEventListener('scroll', recompute, true);
            window.removeEventListener('resize', recompute);
        };
    }, [isOpen, recompute]);

    useEffect(() => {
        if (!isOpen) return;
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            if (
                triggerRef.current && !triggerRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const isSm = size === 'sm';

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    'inline-flex items-center gap-1.5 rounded-full font-medium border transition-all',
                    'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent',
                    'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
                    isSm ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1.5',
                    colors
                        ? cn(colors.bg, colors.text, 'border-transparent')
                        : 'bg-surface border-border text-secondary hover:bg-surfaceHover',
                )}
            >
                {disabled ? (
                    <Loader2 className={cn('animate-spin', isSm ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
                ) : colors ? (
                    <span className={cn('rounded-full shrink-0', colors.dot, isSm ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
                ) : null}
                <span>{selectedOption?.label || '—'}</span>
                <ChevronDown className={cn(
                    'text-current opacity-50 transition-transform duration-200',
                    isSm ? 'w-3 h-3' : 'w-3.5 h-3.5',
                    isOpen && 'rotate-180',
                )} />
            </button>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed bg-white dark:bg-surface border border-border rounded-lg shadow-xl p-1 overflow-auto"
                    style={{ zIndex: 9999, top: pos.top, left: pos.left, minWidth: pos.minWidth }}
                >
                    {options.map((opt) => {
                        const optColors = opt.value ? TIER_COLOR[opt.value] : null;
                        const isSelected = opt.value === value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={cn(
                                    'w-full text-left px-2.5 py-2 text-sm flex items-center gap-2.5 rounded-md transition-colors',
                                    'hover:bg-surfaceHover focus:outline-none focus-visible:ring-0',
                                    isSelected ? 'font-medium' : 'text-primary',
                                )}
                            >
                                <span className={cn(
                                    'w-2 h-2 rounded-full shrink-0',
                                    optColors ? optColors.dot : 'bg-border',
                                )} />
                                <span className={cn(
                                    'flex-1',
                                    optColors ? optColors.text : 'text-secondary',
                                    isSelected && 'font-medium',
                                )}>
                                    {opt.label}
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                            </button>
                        );
                    })}
                </div>,
                document.body,
            )}
        </>
    );
}
