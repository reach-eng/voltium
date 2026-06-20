import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-14 w-full rounded-xl border border-border bg-card px-4 py-2 text-[1rem] shadow-sm transition-all outline-none disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-muted-foreground/60',
        'focus:border-primary focus:ring-2 focus:ring-primary/10',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        className
      )}
      {...props}
    />
  );
}

export { Input };
