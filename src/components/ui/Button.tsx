import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

type Common = { variant?: Variant; size?: Size; className?: string };

type LinkButtonProps = Common &
  Omit<ComponentProps<typeof Link>, "className"> & { disabled?: boolean };

type NativeButtonProps = Common &
  Omit<ComponentProps<"button">, "className"> & { href?: undefined };

export type ButtonProps = LinkButtonProps | NativeButtonProps;

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium whitespace-nowrap transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hc-blue/40 " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "border-transparent bg-hc-red text-white hover:bg-hc-red/90",
  secondary: "border-line bg-white text-hc-dark hover:bg-mist",
  ghost: "border-transparent bg-transparent text-hc-dark hover:bg-mist",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-[15px]",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: Common = {}): string {
  return cx(base, variants[variant], sizes[size], className);
}

export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { variant, size, className, disabled, children, ...rest } = props;
    const classes = buttonClass({ variant, size, className });
    if (disabled) {
      return (
        <span aria-disabled="true" className={classes}>
          {children}
        </span>
      );
    }
    return (
      <Link className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { variant, size, className, type = "button", ...rest } = props;
  return (
    <button type={type} className={buttonClass({ variant, size, className })} {...rest} />
  );
}
