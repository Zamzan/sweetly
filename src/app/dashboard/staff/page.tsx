import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InviteStaffForm } from "./_components/invite-staff-form";
import { RemoveStaffButton } from "./_components/remove-staff-button";

export default async function StaffPage() {
  const { shop, role } = await getCurrentShopOrRedirect();
  const supabase = await createServerSupabaseClient();

  const { data: members } = await supabase
    .from("shop_members")
    .select("id, role, permissions, user_id, profiles(full_name)")
    .eq("shop_id", shop.id);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl">Staff</h1>

      {role === "OWNER" && (
        <div className="mb-8 rounded-xl border border-brand-100 bg-white p-5">
          <h2 className="mb-4 font-medium">Add Staff Member</h2>
          <p className="mb-3 text-sm text-brand-600">
            They must already have a Sweetly account (any shop or none).
          </p>
          <InviteStaffForm />
        </div>
      )}

      <div className="space-y-2">
        {(members ?? []).map((m: any) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl border border-brand-100 bg-white p-4">
            <div>
              <p className="font-medium">{m.profiles?.full_name ?? "Unknown"}</p>
              <p className="text-sm text-brand-600">
                {m.role}
                {m.role === "STAFF" &&
                  ` — ${[m.permissions?.products && "Products", m.permissions?.orders && "Orders"].filter(Boolean).join(", ") || "no permissions"}`}
              </p>
            </div>
            {role === "OWNER" && m.role !== "OWNER" && <RemoveStaffButton memberId={m.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
