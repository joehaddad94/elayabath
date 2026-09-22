import type { SVGProps } from "react";

/**
 * Lucide at stroke-width 1.5, which the design system prescribes.
 * Inlined rather than pulled from a package: the site uses seven of them, and
 * an icon dependency would ship thousands.
 */
const paths = {
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  linkedin: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
  youtube: (
    <>
      <path d="M2.5 17a24 24 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49 49 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24 24 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49 49 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </>
  ),
  instagram: (
    <>
      <rect width="20" height="20" x="2" y="2" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </>
  ),
  x: <path d="M18 2h3l-7.5 8.6L22 22h-6.8l-4.7-6.2L5 22H2l8-9.2L2 2h6.9l4.3 5.7z" />,
  pinterest: (
    <path d="M8 20a7.7 7.7 0 0 0 3.2.9c4.4 0 8-3.6 8-8.4A7.5 7.5 0 0 0 11.5 5C7 5 4.5 8 4.5 11.2c0 1.5.6 3.2 2 3.8.3.1.4 0 .5-.3l.2-.9c0-.2 0-.3-.1-.4a3 3 0 0 1-.6-1.9 4.5 4.5 0 0 1 4.7-4.5c2.5 0 4 1.5 4 3.7 0 2.8-1.2 5.1-3 5.1a1.5 1.5 0 0 1-1.5-1.8c.3-1.2.8-2.4.8-3.2 0-.8-.4-1.4-1.2-1.4-1 0-1.7 1-1.7 2.3 0 .9.3 1.4.3 1.4l-1.2 5.1c-.2.9-.1 2.1 0 2.8" />
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 18,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
