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
export function MenuOpenIcon(props: IconProps) { return <IconFrame {...props}><path d="M4 6.5c3-1 5.7-.4 8 1.5v11c-2.3-1.9-5-2.5-8-1.5zM20 6.5c-3-1-5.7-.4-8 1.5v11c2.3-1.9 5-2.5 8-1.5z" /></IconFrame>; }
export function DishViewsIcon(props: IconProps) { return <IconFrame {...props}><path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5zM9.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0z" /></IconFrame>; }
export function SearchIcon(props: IconProps) { return <IconFrame {...props}><path d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5 21 21" /></IconFrame>; }
export function ImmersiveIcon(props: IconProps) { return <IconFrame {...props}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" /></IconFrame>; }
export function AvailableDishIcon(props: IconProps) { return <IconFrame {...props}><path d="M4 13h16M6 13a6 6 0 0 1 12 0M12 7V4M8 18h8" /></IconFrame>; }
export function EventIcon(props: IconProps) { return <IconFrame {...props}><path d="M5 5h14v14H5zM8 3v4M16 3v4M5 9h14M8 13h2M14 13h2" /></IconFrame>; }
export function PeriodIcon(props: IconProps) { return <IconFrame {...props}><path d="M12 3a9 9 0 1 0 9 9M12 7v5l3 2M16 3h5v5" /></IconFrame>; }
export function TrendIcon(props: IconProps) { return <IconFrame {...props}><path d="m4 17 5-5 4 3 7-8M15 7h5v5" /></IconFrame>; }

