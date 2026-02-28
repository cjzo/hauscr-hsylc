import { createContext, useContext, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) throw new Error('useConfirm must be used within ConfirmProvider');
    return context;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

    const confirm = (opts: ConfirmOptions) => {
        setOptions(opts);
        setIsOpen(true);
        return new Promise<boolean>((resolve) => {
            setResolver(() => resolve);
        });
    };

    const handleClose = (value: boolean) => {
        setIsOpen(false);
        if (resolver) resolver(value);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <AnimatePresence>
                {isOpen && options && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="fixed inset-0 bg-primary/20 backdrop-blur-sm"
                            onClick={() => handleClose(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="relative w-full max-w-md bg-white dark:bg-surface rounded-md shadow-stripe-hover overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="flex items-start gap-4">
                                    {options.destructive && (
                                        <div className="flex-shrink-0 w-10 h-10 rounded-sm bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500" />
                                        </div>
                                    )}
                                    <div className="pt-1">
                                        <h3 className="text-lg font-semibold text-primary">{options.title}</h3>
                                        <p className="mt-2 text-sm text-secondary">{options.message}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-surface/50 dark:bg-surfaceHover/50 px-6 py-4 flex justify-end gap-3 border-t border-border mt-2">
                                <Button variant="secondary" onClick={() => handleClose(false)}>
                                    {options.cancelText || 'Cancel'}
                                </Button>
                                <Button
                                    variant={options.destructive ? 'danger' : 'primary'}
                                    onClick={() => handleClose(true)}
                                >
                                    {options.confirmText || 'Confirm'}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </ConfirmContext.Provider>
    );
}
