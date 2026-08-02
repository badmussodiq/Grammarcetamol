export const colors = {
  primary: '#1E3A5F',
  primaryLight: '#2A5285',
  primaryDark: '#152B47',
  accent: '#F59E0B',
  accentLight: '#FCD34D',
  accentDark: '#D97706',
  success: '#10B981',
  successBg: '#D1FAE5',
  successText: '#065F46',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  warningText: '#92400E',
  error: '#EF4444',
  errorBg: '#FEE2E2',
  errorText: '#991B1B',
  info: '#6366F1',
  infoBg: '#E0E7FF',
  infoText: '#3730A3',
  neutralBg: '#F1F5F9',
  neutralText: '#475569',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',
  sidebarBg: '#0F172A',
  sidebarText: '#CBD5E1',
  sidebarActive: '#1E3A5F',
  sidebarHover: '#1E293B',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
  lg: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
  xl: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
} as const;

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export const transitions = {
  fast: '100ms ease-out',
  base: '150ms ease-out',
  slow: '200ms ease-out',
} as const;
