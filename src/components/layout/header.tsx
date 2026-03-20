'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export function Header() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  return (
    <header className="border-border bg-background flex h-14 items-center justify-end border-b px-6">
      <button
        onClick={handleSignOut}
        className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </header>
  );
}
