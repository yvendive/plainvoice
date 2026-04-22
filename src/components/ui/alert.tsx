import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'info' | 'warning' | 'destructive';

const variantStyles: Record<Variant, string> = {
  default: 'border-[color:var(--border)] bg-[color:var(--muted)] text-[color:var(--foreground)]',
  info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200',
  destructive:
    'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200',
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { className, variant = 'default', ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="status"
      className={cn('rounded-lg border px-4 py-3 text-sm', variantStyles[variant], className)}
      {...props}
    />
  );
});

export const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function AlertTitle({ className, ...props }, ref) {
    return <h5 ref={ref} className={cn('mb-1 font-semibold', className)} {...props} />;
  },
);

export const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function AlertDescription({ className, ...props }, ref) {
    return <div ref={ref} className={cn('text-sm opacity-90', className)} {...props} />;
  },
);
