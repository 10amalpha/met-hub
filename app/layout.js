import './globals.css';
import { TOKEN } from '../token.config';

const BASE = `https://${TOKEN.host}`;
const OG = `${BASE}/api/og`;

export const metadata = {
  metadataBase: new URL(BASE),
  title: `${TOKEN.name} ($${TOKEN.symbol}) — Thesis Telemetry | 10AMPRO`,
  description: TOKEN.description,
  alternates: { canonical: BASE },
  openGraph: { title: `${TOKEN.name} — ${TOKEN.tagline}`, description: TOKEN.description, url: BASE, siteName: '10AMPRO', type: 'article', locale: 'es_ES', images: [{ url: OG, width: 1200, height: 630, alt: `${TOKEN.name} — ${TOKEN.tagline}` }] },
  twitter: { card: 'summary_large_image', title: `${TOKEN.name} — ${TOKEN.tagline}`, description: TOKEN.description, images: [OG] },
  robots: { index: true, follow: true },
};
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, themeColor: '#0c0c0e' };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/logo.jpg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
