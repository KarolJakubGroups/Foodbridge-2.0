import type { Metadata } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';

const figtree = Figtree({ variable: '--font-figtree', subsets: ['latin'] });
const bricolage = Bricolage_Grotesque({ variable: '--font-bricolage', subsets: ['latin'], weight: ['600', '700'] });

export const metadata: Metadata = {
  title: 'FoodBridge · Schweizer Tafel',
  description: 'Plattform der Stiftung Schweizer Tafel, um überschüssige Lebensmittel zu retten und zu verteilen',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="de" className={`${figtree.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
