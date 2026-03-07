import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps {
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function Select({ options, value, onChange, placeholder = 'Select...', className }: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

    const selectedOption = options.find((opt) => opt.value === value);

    const recompute = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
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

    return (
        <div className={cn("relative w-full", className)}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full h-10 px-3 bg-white dark:bg-surface border border-border rounded-sm shadow-sm text-left flex items-center justify-between hover:bg-surface transition-all"
            >
                <span className={cn("block truncate text-sm", !selectedOption && "text-muted")}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={cn("w-4 h-4 text-muted transition-transform duration-200", isOpen && "rotate-180")} />
            </button>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed bg-white dark:bg-surface border border-border rounded-sm shadow-xl p-1 max-h-60 overflow-auto"
                    style={{ zIndex: 9999, top: pos.top, left: pos.left, width: pos.width }}
                >
                    {options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={cn(
                                "w-full text-left px-2 py-1.5 text-sm flex items-center justify-between hover:bg-surfaceHover transition-colors focus:outline-none focus-visible:ring-0 focus-visible:shadow-none rounded-sm",
                                option.value === value ? "text-accent font-medium dark:text-accent" : "text-primary"
                            )}
                        >
                            {option.label}
                            {option.value === value && <Check className="w-4 h-4" />}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}
