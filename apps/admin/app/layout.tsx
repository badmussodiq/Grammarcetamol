import type {Metadata} from 'next';
import './globals.css';
import {ToastProvider, ToastRenderer} from '@grammarcetamol/utilities';
import {AuthProvider} from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: 'Grammarcetamol Admin',
  description: 'Admin Control Center',
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
