import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata = {
  title: 'Fluri — Next.js hydration example',
  description:
    'A real Next.js App Router integration with server rendering, client-only weather startup, and route cleanup.',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link className="brand" href="/">
            <span aria-hidden="true">❄</span>fluri
          </Link>
          <nav aria-label="Example navigation">
            <Link href="/">Snowy page</Link>
            <Link id="leave-weather" href="/about">
              Plain page
            </Link>
          </nav>
        </header>
        {children}
        <footer>
          <span>@themes/fluri-react · MIT licensed</span>
          <span>Next.js App Router integration</span>
        </footer>
      </body>
    </html>
  );
}
