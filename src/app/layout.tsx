import type { Metadata } from 'next';
import './globals.css';
import { Inter } from 'next/font/google';
import { AnalyticsProvider } from '@/components/providers/AnalyticsProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Refr',
  description: 'Find your perfect internship match using AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' className={inter.className}>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body>
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  );
}
