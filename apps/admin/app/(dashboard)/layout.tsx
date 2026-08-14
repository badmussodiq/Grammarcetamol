import {Sidebar} from '@/components/Sidebar';
import {TopHeader} from '@/components/TopHeader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
