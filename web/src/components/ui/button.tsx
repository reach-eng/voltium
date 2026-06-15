import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[0.9375rem] font-semibold transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0px_8px_24px_rgba(0,83,193,0.25)] hover:bg-primary/95 rounded-full',
        destructive: 'bg-destructive text-white shadow-xs hover:bg-destructive/90 rounded-full',
        outline:
          'border border-border bg-background shadow-xs hover:bg-muted text-foreground rounded-full',
        secondary:
          'bg-vf-surface-container text-foreground hover:bg-vf-surface-container-high rounded-xl', // Material 3 Filled
        ghost: 'hover:bg-muted text-foreground rounded-lg',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-6 py-2.5',
        sm: 'h-9 px-4 text-sm',
        lg: 'h-14 px-8 text-lg',
        xl: 'h-16 px-10 text-lg', // mobile primary action
        icon: 'size-11 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
