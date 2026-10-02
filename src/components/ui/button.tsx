"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { playUiSound } from "@/lib/uiSound"

const buttonVariants = cva(
  "fx-btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-[0_8px_24px_rgba(239,68,68,0.25)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-[0_8px_24px_rgba(239,68,68,0.25)]",
        outline:
          "border border-input bg-background/60 hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        gradient:
          "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-[0_8px_30px_rgba(239,68,68,0.35)] hover:shadow-[0_10px_36px_rgba(239,68,68,0.45)] press-effect",
        glass:
          "glass-strong text-foreground hover:bg-white/10 border-white/10",
        "outline-glow":
          "border border-red-500/40 bg-transparent text-foreground hover:border-glow hover:shadow-[0_0_24px_rgba(239,68,68,0.25)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8 text-base",
        xs: "h-8 rounded-md px-2.5 text-xs",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, children, disabled, onClick, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        playUiSound("tap")
        onClick?.(e)
      },
      [onClick]
    )
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={loading || disabled}
        aria-busy={loading || undefined}
        onClick={asChild ? onClick : handleClick}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin-slow" />
            {children}
          </span>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
