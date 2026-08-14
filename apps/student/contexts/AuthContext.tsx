'use client';

import React, {createContext, useCallback, useContext, useEffect, useReducer} from 'react';
import {ApiError} from '@grammarcetamol/utilities';
import {authApi, AuthUser} from '@/lib/auth.api';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: AuthUser }
  | { type: 'CLEAR_USER' };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return { user: action.payload, isLoading: false, isAuthenticated: true };
    case 'CLEAR_USER':
      return { user: null, isLoading: false, isAuthenticated: false };
    default:
      return state;
  }
}

const initialState: AuthState = { user: null, isLoading: true, isAuthenticated: false };

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const refreshUser = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}/api/users/me`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const { data } = await res.json();
        // /api/users/me returns the raw profile shape ({id, role, ...}), not the
        // {userId, roles} shape the login response uses — map it so downstream code
        // (e.g. reading user.roles) works consistently regardless of which path set it.
        dispatch({ type: 'SET_USER', payload: { userId: data.id, email: data.email, roles: data.role, fullName: data.fullName } });
      } else {
        dispatch({ type: 'CLEAR_USER' });
      }
    } catch {
      dispatch({ type: 'CLEAR_USER' });
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    const roles = res.data.roles.split(',');
    if (!roles.includes('STUDENT')) {
      // Credentials were valid but this is a staff account — the backend has
      // already issued cookies for it, so revoke them before rejecting the login.
      try { await authApi.logout(); } catch {}
      throw new ApiError(403, 'This portal is for students only. Please use the admin site to sign in.');
    }
    dispatch({ type: 'SET_USER', payload: res.data });
    // The login response only carries {userId, email, roles} — refresh once more to pick up the
    // rest of the profile (fullName, etc.) without waiting for the next full page load.
    await refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    dispatch({ type: 'CLEAR_USER' });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
