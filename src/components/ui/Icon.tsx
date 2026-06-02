import type { SVGProps } from "react";

export type IconName =
  | "football"
  | "basketball"
  | "tennis"
  | "volleyball"
  | "esports"
  | "mma"
  | "baseball"
  | "americanfootball"
  | "icehockey"
  | "search"
  | "live"
  | "star"
  | "fire"
  | "clock"
  | "user"
  | "wallet"
  | "trophy"
  | "chevronRight"
  | "chevronDown"
  | "plus"
  | "close"
  | "check"
  | "settings"
  | "logout"
  | "ticket"
  | "bell"
  | "shield"
  | "bolt"
  | "info"
  | "cashout"
  | "lock"
  | "mail"
  | "calendar"
  | "users"
  | "chart"
  | "filter";

/** Conteúdo de cada ícone (viewBox 0 0 24 24, traço em currentColor). */
const PATHS: Record<IconName, JSX.Element> = {
  football: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5l3.8 2.8-1.5 4.5h-4.6L8.2 10.3 12 7.5z" />
      <path d="M12 3v4.5M19.5 9.8l-3.7 2.6M16.5 19l-2.2-4.2M7.5 19l2.2-4.2M4.5 9.8l3.7 2.6" />
    </>
  ),
  basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18M5.6 5.6c3 2 4 8 1.6 12.8M18.4 5.6c-3 2-4 8-1.6 12.8" />
    </>
  ),
  tennis: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 5.5c4 2.5 4 10.5 0 13M18.5 5.5c-4 2.5-4 10.5 0 13" />
    </>
  ),
  volleyball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c2.5 3 3 7 1 12M21 12c-3.5-1-7 0-10 4M3 12c1.5-3 5-5 9-4.5" />
    </>
  ),
  esports: (
    <>
      <path d="M7 8h10a4 4 0 0 1 4 4l-.6 4.2A2.6 2.6 0 0 1 17.8 18c-1 0-1.6-.6-2.2-1.3L14 15h-4l-1.6 1.7C7.8 17.4 7.2 18 6.2 18a2.6 2.6 0 0 1-2.6-1.8L3 12a4 4 0 0 1 4-4z" />
      <path d="M7 11v2M6 12h2M15.5 11.5h.01M17.5 13.5h.01" />
    </>
  ),
  mma: (
    <>
      <path d="M7 11V8.5a2 2 0 0 1 4 0V11" />
      <path d="M11 9.5a1.8 1.8 0 0 1 3.5 0V11" />
      <path d="M14.5 10a1.6 1.6 0 0 1 3 0v3.5a5 5 0 0 1-5 5h-1.8a5 5 0 0 1-4.7-3.3L5 12.5A1.6 1.6 0 0 1 7 11" />
    </>
  ),
  baseball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.7 4.6c-3 2.6-3 12.2 0 14.8" />
      <path d="M14.1 7.6l1.5-.6M13.5 10l1.6-.3M13.5 14l1.6.3M14.1 16.4l1.5.6" />
    </>
  ),
  americanfootball: (
    <>
      <path d="M4 12c3-4.2 13-4.2 16 0-3 4.2-13 4.2-16 0z" />
      <path d="M7 12h10M10.5 10.6v2.8M12 10.3v3.4M13.5 10.6v2.8" />
    </>
  ),
  icehockey: (
    <>
      <path d="M5.5 4.5L13 16.7l3.2 1.1" />
      <ellipse cx="17.5" cy="18.8" rx="2.7" ry="1.2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  live: (
    <>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M5 5a9.5 9.5 0 0 0 0 14M19 19a9.5 9.5 0 0 0 0-14" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8-4.3-4.1 5.9-.9L12 3.5z" />,
  fire: (
    <path d="M12 3c1 3-1 4.5-1 6.5A2.5 2.5 0 0 0 13.5 12c1.2-1 1.5-2.5 1.5-2.5 1.8 1.5 3 3.7 3 6a6 6 0 1 1-12 0c0-3 2-5 3-7 .8-1.6 0-3 1-5z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  wallet: (
    <>
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11a2 2 0 0 1 2 2v1" />
      <path d="M3.5 7.5V17a2 2 0 0 0 2 2H19a2 2 0 0 0 2-2v-2" />
      <path d="M21 10v3h-3.5a1.5 1.5 0 0 1 0-3H21z" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 5h10v3a5 5 0 0 1-10 0V5z" />
      <path d="M7 6H4.5v1A3.5 3.5 0 0 0 8 10.5M17 6h2.5v1a3.5 3.5 0 0 1-3.5 3.5" />
      <path d="M12 13v3M9 19h6M10 19v-2M14 19v-2" />
    </>
  ),
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.5M12 19v2.5M4.2 7l2.2 1.3M17.6 15.7l2.2 1.3M4.2 17l2.2-1.3M17.6 8.3l2.2-1.3" />
    </>
  ),
  logout: (
    <>
      <path d="M14 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
      <path d="M10 12h11M18 9l3 3-3 3" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" />
      <path d="M14 6v2M14 11v2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  shield: <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />,
  bolt: <path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.8h.01" />
    </>
  ),
  cashout: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9.5 9.2c0-1 1.1-1.7 2.5-1.7s2.5.7 2.5 1.7-1.1 1.5-2.5 1.8-2.5.8-2.5 1.8 1.1 1.7 2.5 1.7 2.5-.7 2.5-1.7" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7.5l8 5.5 8-5.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 9.5h16M8 3v4M16 3v4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M21 19a6 6 0 0 0-4-5.7" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </>
  ),
  filter: <path d="M4 5h16l-6 7v6l-4-2v-4L4 5z" />,
};

const FILLED: Partial<Record<IconName, boolean>> = { star: true, fire: true, shield: true, bolt: true };

export function Icon({
  name,
  size = 18,
  className,
  ...props
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  const filled = FILLED[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
