'use client';

import { useState } from 'react';
import { Button, Badge, Spinner, Skeleton, ProgressBar } from '@grammarcetamol/ui';

export default function StudentHome() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(65);

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: '0 24px', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#1E3A5F', marginBottom: 32 }}>Grammarcetamol — Student UI Showcase</h1>

      {/* Badges */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ color: '#0F172A', marginBottom: 12 }}>Badges</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Badge variant="success" dot>Active</Badge>
          <Badge variant="warning" dot>In Progress</Badge>
          <Badge variant="error">Failed</Badge>
          <Badge variant="info" size="lg">New</Badge>
          <Badge variant="neutral">Draft</Badge>
        </div>
      </section>

      {/* Progress */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ color: '#0F172A', marginBottom: 12 }}>Course Progress</h2>
        <ProgressBar value={progress} showLabel />
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <Button size="sm" variant="secondary" onClick={() => setProgress((p) => Math.max(0, p - 10))}>−10%</Button>
          <Button size="sm" onClick={() => setProgress((p) => Math.min(100, p + 10))}>+10%</Button>
        </div>
      </section>

      {/* Buttons */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ color: '#0F172A', marginBottom: 12 }}>Buttons</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 2000); }} loading={loading}>
            Submit Assignment
          </Button>
          <Button variant="secondary">Save Draft</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Delete</Button>
          <Button disabled>Unavailable</Button>
        </div>
      </section>

      {/* Spinners */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ color: '#0F172A', marginBottom: 12 }}>Spinners</h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Spinner size="sm" color="#1E3A5F" />
          <Spinner size="md" color="#F59E0B" />
          <Spinner size="lg" color="#10B981" />
        </div>
      </section>

      {/* Skeletons */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ color: '#0F172A', marginBottom: 12 }}>Skeletons</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Skeleton variant="circle" width={40} height={40} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
            </div>
          </div>
          <Skeleton variant="rect" height={80} />
        </div>
      </section>
    </main>
  );
}
