'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type RadioGroupContextValue = {
  name: string;
  value: string | undefined;
  onChange: (value: string) => void;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  name: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export function RadioGroup({
  className,
  name,
  value: controlled,
  defaultValue,
  onValueChange,
  children,
  ...props
}: RadioGroupProps) {
  const [uncontrolled, setUncontrolled] = React.useState<string | undefined>(defaultValue);
  const value = controlled ?? uncontrolled;

  const handleChange = React.useCallback(
    (next: string) => {
      if (controlled === undefined) setUncontrolled(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  return (
    <RadioGroupContext.Provider value={{ name, value, onChange: handleChange }}>
      <div role="radiogroup" className={cn('flex flex-col gap-2', className)} {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioGroupItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
}

export const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  function RadioGroupItem({ className, value, label, hint, id, ...props }, ref) {
    const ctx = React.useContext(RadioGroupContext);
    if (!ctx) throw new Error('RadioGroupItem must be used inside RadioGroup');
    const inputId = id ?? `${ctx.name}-${value}`;
    return (
      <label htmlFor={inputId} className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          ref={ref}
          id={inputId}
          type="radio"
          name={ctx.name}
          value={value}
          checked={ctx.value === value}
          onChange={() => ctx.onChange(value)}
          className={cn(
            'mt-0.5 h-4 w-4 accent-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]',
            className,
          )}
          {...props}
        />
        <span>
          <span className="block">{label}</span>
          {hint ? (
            <span className="block text-xs text-[color:var(--muted-foreground)]">{hint}</span>
          ) : null}
        </span>
      </label>
    );
  },
);
