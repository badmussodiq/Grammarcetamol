'use client';

import { useState } from 'react';
import { Button, Badge, Spinner, Skeleton, ProgressBar } from '@grammarcetamol/ui';

export default function AdminHome() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(40);

  return (
    <main style={{ maxWidth: 800, margin: '40px auto', padding: '0 24px', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#0F172A', marginBottom: 4 }}>Grammarcetamol — Admin Dashboard</h1>
      <p style={{ color: '#64748B', marginBottom: 32 }}>UI component showcase</p>

      {/* Status Badges */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ color: '#0F172A', marginBottom: 12 }}>Student Status Overview</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Badge variant="success" dot>Enrolled</Badge>
          <Badge variant="warning" dot>Pending Review</Badge>
          <Badge variant="error" dot>Suspended</Badge>
          <Badge variant="info">New Registration</Badge>
          <Badge variant="neutral" size="lg">Alumni</Badge>
        </div>
      </section>

      {/* System Health */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ color: '#0F172A', marginBottom: 12 }}>System Health</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ minWidth: 120, color: '#64748B', fontSize: 14 }}>CPU Usage</span>
            <ProgressBar value={72} showLabel color="#1E3A5F" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ minWidth: 120, color: '#64748B', fontSize: 14 }}>Memory</span>
            <ProgressBar value={55} showLabel color="#0EA5E9" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ minWidth: 120, color: '#64748B', fontSize: 14 }}>Disk</span>
            <ProgressBar value={progress} showLabel color="#10B981" />
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <Button size="sm" variant="secondary" onClick={() => setProgress((p) => Math.max(0, p - 10))}>−10%</Button>
          <Button size="sm" onClick={() => setProgress((p) => Math.min(100, p + 10))}>+10%</Button>
        </div>
      </section>

      {/* Actions */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ color: '#0F172A', marginBottom: 12 }}>Admin Actions</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 2000); }} loading={loading}>
            Sync Users
          </Button>
          <Button variant="secondary">Export CSV</Button>
          <Button variant="ghost">View Logs</Button>
          <Button variant="destructive">Reset Cache</Button>
        </div>
      </section>

      {/* Loaders */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ color: '#0F172A', marginBottom: 12 }}>Loading States</h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
          <Spinner size="sm" color="#0F172A" />
          <Spinner size="md" color="#0EA5E9" />
          <Spinner size="lg" color="#1E3A5F" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton variant="rect" height={48} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Skeleton variant="circle" width={32} height={32} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton variant="text" width="70%" />
              <Skeleton variant="text" width="45%" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
