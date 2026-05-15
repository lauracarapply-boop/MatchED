import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MatchED Pipeline',
  description: 'AI-powered opportunity discovery and management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}