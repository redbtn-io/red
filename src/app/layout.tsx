import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SetVh from '@/components/layout/SetVh';
import { AuthProvider } from '@/contexts/AuthContext';
import { ConversationProvider } from '@/contexts/ConversationContext';
import PreventZoom from '@/components/layout/PreventZoom';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Red AI Chat",
  description: "Conversational AI powered by Red",
};

// Viewport settings to prevent zoom on iOS and other mobile devices
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SetVh />
        <PreventZoom />
        <AuthProvider>
          <ConversationProvider>
            {children}
          </ConversationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
