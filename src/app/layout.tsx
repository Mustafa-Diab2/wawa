import type { Metadata } from 'next';
import { Space_Grotesk, PT_Sans } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
});

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-pt-sans',
});

export const metadata: Metadata = {
  title: 'WaCRM - WhatsApp CRM Platform',
  description: 'A comprehensive platform for managing customer relationships via WhatsApp with advanced features.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${spaceGrotesk.variable} ${ptSans.variable}`}>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
