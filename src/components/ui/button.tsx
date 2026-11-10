import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        gold: "bg-gold-foil border border-gold-700/70 text-burgundy-900 shadow-[0_2px_0_rgba(122,87,25,0.55),0_6px_14px_rgba(0,0,0,0.25)] hover:brightness-110 active:translate-y-px",
        burgundy: "bg-wine border border-gold-400/50 text-parchment-50 shadow-md hover:brightness-125",
        outline:
          "border-2 border-gold-400 text-gold-400 hover:bg-gold-400 hover:text-burgundy-900",
        outlineLight:
          "border-2 border-burgundy-700 text-burgundy-700 hover:bg-burgundy-700 hover:text-parchment-50",
        ghost: "text-current hover:bg-white/10",
      },
      size: {
        default: "min-h-11 px-6 py-2 text-base",
        sm: "min-h-11 px-4 py-2 text-sm",
        lg: "min-h-12 px-8 py-3 text-lg",
      },
    },
    defaultVariants: { variant: "gold", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner and disables the button while an action is running. */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  if (asChild) {
    return <Slot className={cn(buttonVariants({ variant, size }), className)} {...props}>{children}</Slot>;
  }
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {children}
    </button>
  );
}

export { buttonVariants };
