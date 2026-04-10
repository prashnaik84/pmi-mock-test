import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PMP Mock Exam — Practice Tests | $0.49 Per Test',
  description: 'AI-generated PMP practice tests aligned to the PMI Exam Content Outline 2021+. Each test is unique. $0.49 per session. Instant access.',
  openGraph: {
    title: 'PMP Mock Exam Practice Tests',
    description: 'Unique AI-generated PMP questions. $0.49 per test. Instant access.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
