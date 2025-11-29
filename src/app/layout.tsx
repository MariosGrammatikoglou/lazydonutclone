import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LazyDonut Clone',
  description: 'Clone online by LazyDonut.',
  metadataBase: new URL('https://lazydonutspyroom.vercel.app/'), 
  openGraph: {
    title: 'LazyDonut Clone',
    description: 'SpyRoom online by Clone.',
    url: 'https://lazydonutclone.vercel.app/',
    siteName: 'LazyDonut Clone',
    images: [
      {
        url: '/mymetaimage.png', 
        width: 1200,
        height: 630,
        alt: 'LazyDonut Clone',
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
