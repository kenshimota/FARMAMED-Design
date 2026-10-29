import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "alert"
  | "arrow-right"
  | "arrow-up-right"
  | "bell"
  | "box"
  | "calculator"
  | "cart"
  | "chart"
  | "check"
  | "chevron-down"
  | "clipboard"
  | "clock"
  | "close"
  | "coins"
  | "database"
  | "eye"
  | "eye-off"
  | "home"
  | "image"
  | "layers"
  | "link"
  | "map-pin"
  | "menu"
  | "package"
  | "pill"
  | "search"
  | "shield"
  | "sparkles"
  | "tag"
  | "truck"
  | "user"
  | "users"
  | "warehouse";

const paths: Record<IconName, ReactNode> = {
  calculator: (
    <>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9" cy="6" rx="6" ry="3" />
      <path d="M3 6v4c0 1.7 2.7 3 6 3 1.2 0 2.3-.2 3.2-.5M3 10v4c0 1.7 2.7 3 6 3h1" />
      <ellipse cx="16" cy="15" rx="5" ry="5" />
      <path d="M16 12.5v5M14.5 14h2a1 1 0 0 1 0 2h-1a1 1 0 0 0 0 2h2" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="m3 3 18 18" />
      <path d="M10.6 5.1A11 11 0 0 1 12 5c6.4 0 10 7 10 7a18.6 18.6 0 0 1-2.4 3.4" />
      <path d="M6.2 6.7A18.4 18.4 0 0 0 2 12s3.6 7 10 7c1.5 0 2.9-.3 4.1-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.6 13.7 20.5a2 2 0 0 1-2.8 0L3.5 13.1a2 2 0 0 1-.6-1.4V5a2 2 0 0 1 2-2h6.7a2 2 0 0 1 1.4.6l7.6 7.1a2 2 0 0 1 0 2.9Z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22a8 8 0 0 1 16 0" />
    </>
  ),
  warehouse: (
    <>
      <path d="m3 9 9-6 9 6v12H3V9Z" />
      <path d="M7 21v-8h10v8M7 9h.01M12 9h.01M17 9h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.7 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  "arrow-right": <path d="M5 12h14m-6-6 6 6-6 6" />,
  "arrow-up-right": <path d="M7 17 17 7M7 7h10v10" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
    </>
  ),
  box: (
    <>
      <path d="m21 8-9-5-9 5 9 5 9-5Z" />
      <path d="m3 8 9 5 9-5M3 8v8l9 5 9-5V8M12 13v8" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1" />
      <circle cx="19" cy="20" r="1" />
      <path d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.6L22 7H6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  package: (
    <>
      <path d="M16.5 9.4 7.5 4.2M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </>
  ),
  pill: (
    <>
      <path d="m10.5 20.5-7-7a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7Z" />
      <path d="m7 10 7 7M14 4h.01M18 8h.01M20 3h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3-1.3 3.7L7 8l3.7 1.3L12 13l1.3-3.7L17 8l-3.7-1.3L12 3ZM5 14l-.9 2.1L2 17l2.1.9L5 20l.9-2.1L8 17l-2.1-.9L5 14ZM19 13l-.9 2.1-2.1.9 2.1.9L19 19l.9-2.1L22 16l-2.1-.9L19 13Z" />
    </>
  ),
  truck: (
    <>
      <path d="M10 17h4V5H2v12h3M14 9h4l4 4v4h-3M14 17h1" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="17.5" r="2.5" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      <circle cx="9" cy="7" r="4" />
    </>
  ),
};

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
};

export function Icon({ name, size = 24, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
