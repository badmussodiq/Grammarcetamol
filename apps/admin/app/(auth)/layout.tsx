import type {ReactNode} from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Grammarcetamol</h1>
          <p className="text-sidebar-text text-sm mt-1">Admin Control Center</p>
        </div>
        <div className="bg-surface rounded-xl shadow-xl p-8 border border-border">
          {children}
        </div>
      </div>
    </div>
  );
}
