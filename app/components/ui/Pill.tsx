import type { ReactNode } from "react";

interface PillProps {
  children: ReactNode;
  variant?: "default" | "accent" | "success" | "danger" | "warning";
  href?: string;
  className?: string;
}

const VARIANT: Record<NonNullable<PillProps["variant"]>, string> = {
  default: "border-monad-border/80 text-txt-muted",
  accent:  "border-accent/30 text-accent/80",
  success: "border-success/30 text-success/80",
  danger:  "border-danger/30 text-danger/80",
  warning: "border-warning/30 text-warning",
};

export function Pill({ children, variant = "default", href, className = "" }: PillProps) {
  const cls =
    `inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ` +
    `${VARIANT[variant]} ${className}`;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${cls} hover:border-accent/50 hover:text-accent transition-colors`}
      >
        {children}
      </a>
    );
  }

  return <span className={cls}>{children}</span>;
}
