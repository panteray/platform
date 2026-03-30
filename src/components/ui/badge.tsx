import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-pt-purple/15 text-pt-purple-light',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-pt-red/10 text-pt-red',
        outline: 'border-border/60 text-foreground',
        success: 'border-transparent bg-pt-green/10 text-pt-green',
        warning: 'border-transparent bg-pt-orange/10 text-pt-orange',
        info: 'border-transparent bg-pt-teal/10 text-pt-teal',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
