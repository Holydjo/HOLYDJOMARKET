'use client';

/** Client-side gate for private pages. The API enforces the same rules server-side. */
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { Role } from '@/lib/types';
import { homeFor, useAuth } from './AuthProvider';
import { Spinner } from './ui';

export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/connexion?next=${encodeURIComponent(location.pathname)}`);
    else if (user.role !== role) router.replace(homeFor(user));
  }, [user, loading, role, router]);
  if (loading || !user || user.role !== role) return <Spinner />;
  return <>{children}</>;
}
