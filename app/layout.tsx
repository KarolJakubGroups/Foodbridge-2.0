import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin', 'latin-ext'] });

export const metadata: Metadata = {
  title: 'FoodBridge · Schweizer Tafel',
  description: 'Plattform der Stiftung Schweizer Tafel, um überschüssige Lebensmittel zu retten und zu verteilen',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="de" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
