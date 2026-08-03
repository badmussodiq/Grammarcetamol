import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import { ToastRenderer } from '../components/ToastRenderer';

export const metadata: Metadata = {
  title: 'Grammarcetamol',
  description: 'English Language Learning Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AuthProvider>
            {children}
            <ToastRenderer />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
