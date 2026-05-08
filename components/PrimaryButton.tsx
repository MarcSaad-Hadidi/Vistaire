import type { AnchorHTMLAttributes, ReactNode } from "react";

type PrimaryButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  size?: "default" | "small";
};

export function PrimaryButton({
  children,
  className = "",
  size = "default",
  ...props
}: PrimaryButtonProps) {
  const sizeClass =
    size === "small"
      ? "h-10 px-4 text-sm"
      : "min-h-12 px-6 py-3 text-base";

  return (
    <a
      className={`inline-flex max-w-full items-center justify-center rounded-full border border-champagne/50 bg-champagne text-center font-semibold leading-tight text-charcoal shadow-[0_18px_48px_rgba(217,184,121,0.2)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#f0d396] hover:shadow-[0_22px_58px_rgba(217,184,121,0.26)] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </a>
  );
}
