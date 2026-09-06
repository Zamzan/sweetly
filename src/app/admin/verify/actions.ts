"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueAdminElevatedSession, revokeAdminElevatedSession } from "@/lib/admin-auth";
import { decryptSecret, verifyTotpCode, verifyAndConsumeRecoveryCode } from "@/lib/totp";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Super Admin MFA Verification Server Action.
 *
 * Requirements:
 * - RFC 6238 6-digit TOTP verification or single-use recovery code.
 * - Atomic time-step counter tracking to prevent replay attacks.
 * - Strict dual-factor rate limiting per IP and per admin account.
 * - Generic failure messages to prevent user enumeration.
 * - No static PIN or fallback PIN exists.
 */
export async function verifyAdminMfaAction(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  // Confirm user has PLATFORM_ADMIN role
  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .single();

  if (profile?.platform_role !== "PLATFORM_ADMIN") {
    redirect("/403");
  }

  // Strict dual-factor rate limiting: IP-based and Account-based
  const reqHeaders = await headers();
  const ip = getClientIp(reqHeaders);

  const [ipLimit, accountLimit] = await Promise.all([
    checkRateLimit("mfaVerification", `admin-mfa:ip:${ip}`),
    checkRateLimit("mfaVerification", `admin-mfa:user:${user.id}`),
  ]);

  if (!ipLimit.success || !accountLimit.success) {
    return { error: "Too many authentication attempts. Please wait a moment before trying again." };
  }

  const mode = formData.get("mode")?.toString() || "totp";
  const code = formData.get("code")?.toString().trim() || "";

  if (!code) {
    return { error: mode === "recovery" ? "Please enter your recovery code." : "Please enter your 6-digit authenticator code." };
  }

  const admin = createAdminClient();
  const { data: mfaRecord } = await admin
    .from("admin_mfa")
    .select("encrypted_secret, secret_iv, secret_tag, recovery_codes, mfa_enabled, last_used_counter")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!mfaRecord || !mfaRecord.mfa_enabled) {
    redirect("/admin/setup-2fa");
  }

  if (mode === "recovery") {
    // Mode 2: Single-use recovery code
    const recoveryResult = verifyAndConsumeRecoveryCode(code, mfaRecord.recovery_codes || []);
    if (!recoveryResult.valid || !recoveryResult.remainingCodes || !recoveryResult.matchedCodeEntry) {
      return { error: "Invalid or already consumed recovery code." };
    }

    // Atomic recovery code consumption: prevents concurrent double-consumption
    let consumed = false;
    try {
      const { data: rpcConsumed, error: rpcErr } = await admin.rpc("consume_admin_recovery_code", {
        p_user_id: user.id,
        p_consumed_code_entry: recoveryResult.matchedCodeEntry,
      });
      if (!rpcErr) {
        consumed = Boolean(rpcConsumed);
      } else {
        // Fallback to direct array update if RPC is not yet registered
        const { error: updateError } = await admin
          .from("admin_mfa")
          .update({
            recovery_codes: recoveryResult.remainingCodes,
            last_verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
        consumed = !updateError;
      }
    } catch {
      consumed = false;
    }

    if (!consumed) {
      return { error: "This recovery code has already been consumed or is invalid." };
    }

    await issueAdminElevatedSession(user.id);
    redirect("/admin");
  } else {
    // Mode 1: TOTP Authenticator code
    if (!/^\d{6}$/.test(code)) {
      return { error: "Authenticator code must be exactly 6 digits." };
    }

    let secretBase32 = "";
    try {
      secretBase32 = decryptSecret(
        mfaRecord.encrypted_secret,
        mfaRecord.secret_iv,
        mfaRecord.secret_tag
      );
    } catch (err) {
      console.error("Failed to decrypt admin TOTP secret:", err);
      return { error: "Authentication system error. Please contact technical support." };
    }

    const verification = verifyTotpCode(secretBase32, code, Number(mfaRecord.last_used_counter) || 0, 1);
    if (!verification.valid || verification.matchedCounter === undefined) {
      return { error: "Invalid authenticator code. Please ensure your device clock is synchronized." };
    }

    // Atomic replay protection:
    // Update last_used_counter only if it is strictly greater than current last_used_counter.
    // If two concurrent requests arrive with the same valid code, only one can advance!
    let advanced = false;
    try {
      const { data: rpcAdvanced, error: rpcErr } = await admin.rpc("verify_and_update_totp_counter", {
        p_user_id: user.id,
        p_counter: verification.matchedCounter,
      });
      if (!rpcErr) {
        advanced = Boolean(rpcAdvanced);
      } else {
        // Fallback to conditional update
        const { data: updatedRecord, error: counterUpdateError } = await admin
          .from("admin_mfa")
          .update({
            last_used_counter: verification.matchedCounter,
            last_verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .lt("last_used_counter", verification.matchedCounter)
          .select("user_id")
          .maybeSingle();
        advanced = !counterUpdateError && !!updatedRecord;
      }
    } catch {
      advanced = false;
    }

    if (!advanced) {
      return { error: "This authenticator code has already been used. Please wait for the next 30-second code." };
    }

    await issueAdminElevatedSession(user.id);
    redirect("/admin");
  }
}

/**
 * Super Admin Logout Action.
 * Revokes elevated session and redirects to dashboard.
 */
export async function adminLogoutAction() {
  await revokeAdminElevatedSession();
  redirect("/dashboard");
}
