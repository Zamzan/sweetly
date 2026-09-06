"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="w-full rounded-lg border border-brand-100 px-3 py-2 text-left text-sm text-brand-900 hover:bg-brand-50"
    >
      Logout
    </button>
  );
}
