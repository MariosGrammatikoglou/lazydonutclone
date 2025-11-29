import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LazyDonut Undercover',
  description: 'Undercover online by LazyDonut.',
  metadataBase: new URL('https://lazydonutundercover.vercel.app/'), 
  openGraph: {
    title: 'LazyDonut Undercover',
    description: 'Undercover online by LazyDonut.',
    url: 'https://lazydonutundercover.vercel.app/',
    siteName: 'LazyDonut Undercover',
    images: [
      {
        url: '/mymetaimage.png', 
        width: 1200,
        height: 630,
        alt: 'LazyDonut Undercover',
      },
    ],
    type: 'website',
  }
 
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100">
        <div className="page-shell">
          {children}
        </div>
      </body>
    </html>
  );
}
