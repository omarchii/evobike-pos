import type { JSX } from "react";

export type IconName =
  | "alert"
  | "arrowDown"
  | "arrowRight"
  | "arrowUp"
  | "bell"
  | "bike"
  | "bookmark"
  | "box"
  | "calendar"
  | "cash"
  | "check"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight"
  | "clock"
  | "close"
  | "commission"
  | "dashboard"
  | "download"
  | "drag"
  | "export"
  | "eye"
  | "eyeOff"
  | "filter"
  | "invoice"
  | "layaway"
  | "logo"
  | "margin"
  | "moon"
  | "more"
  | "pnl"
  | "plus"
  | "report"
  | "retention"
  | "sales"
  | "search"
  | "share"
  | "sliders"
  | "sun"
  | "user"
  | "wrench";

const PATHS: Record<IconName, JSX.Element> = {
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
  arrowDown: <><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></>,
  arrowRight: <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
  arrowUp: <><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></>,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7Z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  bike: <><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h3l3 11.5M12 17.5 7 10h7l-3-4H8"/></>,
  bookmark: <><path d="M6 3h12v18l-6-4-6 4V3Z"/></>,
  box: <><path d="M3 7 12 3l9 4v10l-9 4-9-4V7Z"/><path d="M3 7l9 4m0 0 9-4m-9 4v10"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 10v.01M18 14v.01"/></>,
  check: <><path d="m5 12 5 5L20 7"/></>,
  chevronDown: <><path d="m6 9 6 6 6-6"/></>,
  chevronLeft: <><path d="m15 6-6 6 6 6"/></>,
  chevronRight: <><path d="m9 6 6 6-6 6"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  close: <><path d="m6 6 12 12M6 18 18 6"/></>,
  commission: <><path d="M12 2v20M7 6h7a3 3 0 1 1 0 6H9a3 3 0 1 0 0 6h8"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
  download: <><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></>,
  drag: <><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></>,
  export: <><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M5 21h14"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="m3 3 18 18"/><path d="M10.5 10.7a2 2 0 0 0 2.8 2.8M7 7.3C4 9 2 12 2 12s3.5 7 10 7c2 0 3.7-.6 5.2-1.5M19.5 16.3C21 14.8 22 13 22 13s-3.5-7-10-7c-1 0-2 .2-3 .5"/></>,
  filter: <><path d="M3 5h18M6 12h12M10 19h4"/></>,
  invoice: <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
  layaway: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 10h8M8 14h5"/><circle cx="16" cy="15" r="2"/></>,
  logo: <><path d="M12 3 4 8v8l8 5 8-5V8l-8-5Z"/></>,
  margin: <><path d="M5 20 19 4"/><path d="M5 4h14v14"/></>,
  moon: <><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></>,
  more: <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
  pnl: <><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  report: <><path d="M8 3h8l4 4v14H4V3h4Z"/><path d="M8 13h8M8 17h5M8 9h5"/></>,
  retention: <><path d="M12 21a9 9 0 1 1 9-9"/><path d="M21 3v6h-6"/><circle cx="12" cy="12" r="3"/></>,
  sales: <><path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-6"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 4.5 4.5"/></>,
  share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.4 6.8-4M8.6 13.6l6.8 4"/></>,
  sliders: <><path d="M4 6h7M15 6h5M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="13" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 3v1M12 20v1M3 12h1M20 12h1M5.6 5.6l.7.7M17.7 17.7l.7.7M5.6 18.4l.7-.7M17.7 6.3l.7-.7"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  wrench: <><path d="M14.7 6.3a4 4 0 0 1 5 5l-11 11a2.8 2.8 0 1 1-4-4l11-11a4 4 0 0 1 0-1Z"/></>,
};

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 20, className = "", strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATHS[name] ?? null}
    </svg>
  );
}
