'use client';

import {useAuth} from '@/contexts/AuthContext';
import {Button, useFetch} from '@grammarcetamol/utilities';
import {useRouter} from 'next/navigation';
import type {UserListResult} from '@/lib/students.api';
import type {Course, Paged} from '@/lib/courses.api';
import type {Paged as SupportPaged, SupportTicket} from '@/lib/support.api';
import type {RevenueSummary} from '@/lib/revenue.api';
import {formatCurrency} from '@/lib/dashboard';

interface StatCardProps {
  label: string;
  value: string | null;
  loading: boolean;
}

function StatCard({ label, value, loading }: StatCardProps) {
  return (
    <div className="bg-surface rounded-lg border border-border p-6 shadow-sm">
      <p className="text-sm text-[#64748B] mb-3">{label}</p>
      {loading || value === null ? (
        <div className="h-7 bg-background rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-[#0F172A]">{value}</p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const { data: students, loading: studentsLoading } = useFetch<UserListResult>('/api/users?role=STUDENT&page=1&limit=1');
  const { data: courses, loading: coursesLoading } = useFetch<Paged<Course>>('/api/courses?status=published&page=1&limit=1');
  const { data: revenue, loading: revenueLoading } = useFetch<RevenueSummary>('/api/payments/revenue/summary');
  const { data: tickets, loading: ticketsLoading } = useFetch<SupportPaged<SupportTicket>>('/api/support/tickets?status=open&page=1&limit=1');

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Admin Dashboard</h1>
            <p className="text-[#64748B] mt-1 text-sm">
              Welcome back, <span className="text-primary font-medium">{user?.email ?? 'Admin'}</span>
            </p>
          </div>
          <Button variant="secondary" onClick={handleLogout}>Sign Out</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard label="Total Students" value={students ? String(students.total) : null} loading={studentsLoading} />
          <StatCard label="Active Courses" value={courses ? String(courses.total) : null} loading={coursesLoading} />
          <StatCard label="Revenue" value={revenue ? formatCurrency(revenue.lifetimeRevenue) : null} loading={revenueLoading} />
          <StatCard label="Support Requests" value={tickets ? String(tickets.total) : null} loading={ticketsLoading} />
        </div>
      </div>
    </div>
  );
}
