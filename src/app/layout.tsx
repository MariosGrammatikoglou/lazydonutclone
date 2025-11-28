import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LazyDonut Undercover',
  description: 'Lightweight online Undercover / Mr White party game',
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
