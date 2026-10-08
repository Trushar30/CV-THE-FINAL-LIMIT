import type { SVGProps, ReactElement } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
  className?: string;
}

const baseProps = (size: number | string = 20, color = 'currentColor') => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth: 2,
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
