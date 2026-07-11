import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function IconFrame({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? "img" : undefined} {...props}>
      {title ? <title>{title}</title> : null}{children}
    </svg>
  );
}

export function OverviewIcon(props: IconProps) { return <IconFrame {...props}><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></IconFrame>; }
export function AvailabilityIcon(props: IconProps) { return <IconFrame {...props}><path d="M5 5h14v14H5zM8 12l2.4 2.4L16.5 8" /></IconFrame>; }
export function InsightsIcon(props: IconProps) { return <IconFrame {...props}><path d="M5 19V9M12 19V5M19 19v-7" /></IconFrame>; }
export function ExternalIcon(props: IconProps) { return <IconFrame {...props}><path d="M14 5h5v5M19 5l-8 8M19 14v5H5V5h5" /></IconFrame>; }
export function CopyIcon(props: IconProps) { return <IconFrame {...props}><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5H5v11h3" /></IconFrame>; }
export function LogoutIcon(props: IconProps) { return <IconFrame {...props}><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></IconFrame>; }
export function InfoIcon(props: IconProps) { return <IconFrame {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></IconFrame>; }
export function CheckIcon(props: IconProps) { return <IconFrame {...props}><path d="m5 12 4 4L19 6" /></IconFrame>; }
export function AlertIcon(props: IconProps) { return <IconFrame {...props}><path d="M12 4 3.5 19h17L12 4Z" /><path d="M12 9v4M12 16h.01" /></IconFrame>; }

