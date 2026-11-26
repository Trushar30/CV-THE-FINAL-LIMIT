import type { SVGProps, ReactElement } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
  className?: string;
}

const baseProps = (size: number | string = 16, color = 'currentColor') => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/* Core UI & Navigation Vector Symbols */

export function SparklesIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M12 3c0 4.5-3.5 8-8 8 4.5 0 8 3.5 8 8 0-4.5 3.5-8 8-8-4.5 0-8-3.5-8-8z" />
      <path d="M19 3v4M21 5h-4" />
      <path d="M5 19v2M6 20H4" />
    </svg>
  );
}

export function TrophyIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
      <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
      <path d="M6 3h12v7a6 6 0 0 1-12 0V3z" />
      <path d="M12 16v4" />
      <path d="M8 20h8" />
    </svg>
  );
}

export function RocketIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6.05 11a22.35 22.35 0 0 1-3.95 2z" />
      <path d="M9 12H4s.5-3 3-4" />
      <path d="M12 9V4s3 .5 4 3" />
    </svg>
  );
}

export function BriefcaseIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <rect x="2" y="7" width="20" height="14" rx="3" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <path d="M12 12v2" />
      <path d="M2 13h20" />
    </svg>
  );
}

export function ClipboardListIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 3h8a1 1 0 0 1 1 1v1H7V4a1 1 0 0 1 1-1z" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </svg>
  );
}

export function BuildingIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h2M14 7h2" />
      <path d="M8 11h2M14 11h2" />
      <path d="M8 15h2M14 15h2" />
      <path d="M10 21v-3h4v3" />
    </svg>
  );
}

export function ZapIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function BotIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <rect x="3" y="11" width="18" height="10" rx="3" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="15" x2="8.01" y2="15" strokeWidth={3} />
      <line x1="16" y1="15" x2="16.01" y2="15" strokeWidth={3} />
      <path d="M9 18h6" />
    </svg>
  );
}

export function ShieldCheckIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function BrainCircuitIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M12 3a4 4 0 0 0-4 4v10a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4z" />
      <path d="M8 8H5a2 2 0 0 0-2 2v2" />
      <path d="M16 8h3a2 2 0 0 1 2 2v2" />
      <path d="M8 16H5a2 2 0 0 1-2-2v-2" />
      <path d="M16 16h3a2 2 0 0 0 2-2v-2" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function LaptopIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}

export function CloudIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}

export function CoinIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10" />
      <path d="M15 9.5a2.5 2.5 0 0 0-5 0c0 3 5 2 5 5a2.5 2.5 0 0 1-5 0" />
    </svg>
  );
}

export function SunIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

export function MoonIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function BarChartIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </svg>
  );
}

export function FolderEmptyIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function MenuIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export function CloseIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function CheckIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ActivityIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export function SearchIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function StarIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function UsersIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function ChevronRightIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/* Rich Apple-Grade Vector Illustrations */

export function EmptyApplicationIllustration({
  size = 96,
  className,
}: {
  size?: number;
  className?: string;
}): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="48" cy="48" r="42" fill="var(--cv-brand-primary-50)" opacity="0.4" />
      <rect
        x="24"
        y="20"
        width="48"
        height="56"
        rx="8"
        fill="var(--cv-bg-surface-elevated)"
        stroke="var(--cv-palette-winter-garden)"
        strokeWidth="2"
      />
      <rect
        x="32"
        y="32"
        width="32"
        height="4"
        rx="2"
        fill="var(--cv-palette-cascades)"
        opacity="0.8"
      />
      <rect
        x="32"
        y="42"
        width="24"
        height="4"
        rx="2"
        fill="var(--cv-palette-charon)"
        opacity="0.6"
      />
      <rect
        x="32"
        y="52"
        width="28"
        height="4"
        rx="2"
        fill="var(--cv-palette-charon)"
        opacity="0.4"
      />
      <circle
        cx="64"
        cy="64"
        r="14"
        fill="var(--cv-palette-cascades)"
        stroke="var(--cv-palette-child-of-light)"
        strokeWidth="3"
      />
      <path
        d="M60 64l3 3 6-6"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FounderBadgeIllustration({
  size = 96,
  className,
}: {
  size?: number;
  className?: string;
}): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="48" cy="48" r="44" fill="var(--cv-palette-winter-garden)" opacity="0.25" />
      <rect
        x="22"
        y="22"
        width="52"
        height="52"
        rx="16"
        fill="linear-gradient(135deg, var(--cv-palette-cascades) 0%, var(--cv-brand-primary-800) 100%)"
        stroke="var(--cv-palette-winter-garden)"
        strokeWidth="2"
      />
      <circle cx="48" cy="48" r="18" fill="var(--cv-gold-500)" opacity="0.2" />
      <path
        d="M40 54l8-14 8 14-8-4-8 4z"
        fill="var(--cv-gold-400)"
        stroke="var(--cv-gold-600)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="48" cy="36" r="3" fill="#ffffff" />
    </svg>
  );
}

export function BellIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function AlertCircleIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth={3} />
    </svg>
  );
}

export function ArrowLeftIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function SendIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function CheckCircle2Icon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

export function XCircleIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

export function MessageSquareIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function TrendingUpIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

export function FlameIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

export function AwardIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  );
}

export function UserIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function LockIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function MailIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

export function EyeIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function RefreshCwIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

export function FileTextIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export function PaperclipIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

export function ScaleIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <line x1="12" y1="3" x2="12" y2="21" />
      <polyline points="5 7 12 4 19 7" />
      <path d="M3 13l2-6 2 6a2 2 0 0 1-4 0z" />
      <path d="M17 13l2-6 2 6a2 2 0 0 1-4 0z" />
    </svg>
  );
}

export function AlertTriangleIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth={3} />
    </svg>
  );
}

export function TargetIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function CrownIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </svg>
  );
}

export function MedalIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <circle cx="12" cy="14" r="7" />
      <path d="M8.21 8.89L7 3l5 3 5-3-1.21 5.89" />
    </svg>
  );
}

export function FilterIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export function SettingsIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function ShoppingCartIcon({ size, color, ...props }: IconProps): ReactElement {
  return (
    <svg {...baseProps(size, color)} {...props}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}
