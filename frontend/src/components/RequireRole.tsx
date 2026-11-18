'use client';

/** Client-side gate for private pages. The API enforces the same rules server-side. */
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { Role } from '@/lib/types';
import { homeFor, useAuth } from './AuthProvider';
import { Spinner } from './ui';

/** `role` can be one role or a list of allowed roles. */
export function RequireRole({ role, children }: { role: Role | Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = Array.isArray(role) ? role : [role];
  const ok = !!user && allowed.includes(user.role);
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/connexion?next=${encodeURIComponent(location.pathname)}`);
    else if (!ok) router.replace(homeFor(user));
  }, [user, loading, ok, router]);
  if (loading || !ok) return <Spinner />;
  return <>{children}</>;
}
