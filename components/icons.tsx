import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/** Stroke icons (24px grid, currentColor). Size them with a `size-*` class. */
function Svg({ children, className = 'size-5', strokeWidth = 2, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" className={className} {...rest}>
      {children}
    </svg>
  );
}

export const LeafIcon = (p: IconProps) => (
  <Svg {...p}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></Svg>
);
export const PlusIcon = (p: IconProps) => <Svg strokeWidth={2.4} {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const MinusIcon = (p: IconProps) => <Svg strokeWidth={2.4} {...p}><path d="M5 12h14" /></Svg>;
export const CheckIcon = (p: IconProps) => <Svg strokeWidth={2.6} {...p}><path d="M20 6 9 17l-5-5" /></Svg>;
export const XIcon = (p: IconProps) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
export const ChevronLeftIcon = (p: IconProps) => <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>;
export const ChevronRightIcon = (p: IconProps) => <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>;
export const SearchIcon = (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Svg>;
export const ClockIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></Svg>;
export const InfoIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Svg>;
export const AlertIcon = (p: IconProps) => (
  <Svg {...p}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4M12 17h.01" /></Svg>
);
export const MapPinIcon = (p: IconProps) => (
  <Svg {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Svg>
);
export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Svg>
);
export const TruckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" />
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
    <circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" />
  </Svg>
);
export const PackageIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
    <path d="M12 22V12" /><path d="m3.3 7 8.7 5 8.7-5" />
  </Svg>
);
export const HomeIcon = (p: IconProps) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Svg>;
export const LayersIcon = (p: IconProps) => (
  <Svg {...p}><path d="m12 2 10 5-10 5L2 7z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></Svg>
);
export const ListIcon = (p: IconProps) => <Svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Svg>;
export const UserCheckIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="m16 11 2 2 4-4" /></Svg>
);
export const ChartIcon = (p: IconProps) => <Svg {...p}><path d="M3 3v18h18" /><path d="M7 16v-4M12 16V8M17 16v-7" /></Svg>;
export const ThermometerIcon = (p: IconProps) => <Svg {...p}><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" /></Svg>;
export const PrinterIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></Svg>
);
export const LogOutIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Svg>
);
