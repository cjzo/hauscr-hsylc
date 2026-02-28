import React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {

        // Stripe styling variants
        const variants = {
            primary: 'bg-accent text-white shadow-sm hover:shadow hover:-translate-y-[1px] hover:bg-accent-hover focus-visible:ring-stripe focus:outline-none dark:text-black',
            secondary: 'bg-white text-primary border border-border shadow-sm hover:bg-surface focus-visible:ring-stripe focus:outline-none dark:bg-surface dark:border-border dark:hover:bg-surfaceHover',
            ghost: 'bg-transparent text-secondary hover:bg-surfaceHover hover:text-primary dark:text-muted dark:hover:text-primary',
            danger: 'bg-white text-red-600 border border-red-200 shadow-sm hover:bg-red-50 focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#ef4444] dark:bg-surface dark:border-red-900/50 dark:hover:bg-red-900/20',
        };

        const sizes = {
            sm: 'h-8 px-3 text-xs',
            md: 'h-10 px-4 py-2',
            lg: 'h-11 px-8 text-base',
        };

        return (
            <button
                ref={ref}
                className={cn(
                    'stripe-btn',
                    variants[variant],
                    sizes[size],
                    isLoading && 'opacity-70 cursor-not-allowed',
                    className
                )}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : null}
                {children}
            </button>
        );
    }
);
Button.displayName = 'Button';
