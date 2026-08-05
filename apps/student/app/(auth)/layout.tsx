import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">Grammarcetamol</h1>
          <p className="text-[#64748B] text-sm mt-1">English Language Learning Platform</p>
        </div>
        <div className="bg-surface rounded-xl shadow-md p-8 border border-border">
          {children}
        </div>
      </div>
    </div>
  );
}
