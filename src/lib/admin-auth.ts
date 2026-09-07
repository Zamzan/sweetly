import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Super Admin Privileged Session Management.
 *
 * Distinguishes between:
 * 1. Authenticated User Session (Supabase Auth JWT)
 * 2. PLATFORM_ADMIN authorization role (database profile)
 * 3. Elevated Admin Session (post-MFA verification token)
 *
 * Security Features:
 * - HMAC-SHA256 authenticated session token.
 * - Absolute session timeout (2 hours) & idle session timeout (30 minutes).
 * - Session rotation upon MFA verification.
 * - SameSite=Strict, HttpOnly, Secure flags.
 * - Sent across /admin, server actions, and /api routes to prevent path-filtering bypasses.
 * - Server-side assertion helper `assertSuperAdminWithMFA` for defense-in-depth.
 */

const ADMIN_ELEVATED_COOKIE = "sweetly_admin_elevated";
const ABSOLUTE_TIMEOUT_SECONDS = 2 * 60 * 60; // 2 hours absolute
const IDLE_TIMEOUT_SECONDS = 30 * 60; // 30 minutes idle

function getSecretKey(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    // Fail loudly instead of silently signing admin sessions with a
    // fixed string that would be visible to anyone who has ever seen
    // this source code (e.g. in a GitHub repo). A missing secret
    // must break admin login, not quietly weaken it.
    throw new Error(
      "ADMIN_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY as fallback) is not configured — " +
        "refusing to issue or verify admin sessions without a real secret."
    );
  }
  return secret;
}

interface ElevatedSessionPayload {
  userId: string;
  issuedAt: number;
  expiresAt: number;
  lastActive: number;
  nonce: string;
}

/**
 * Signs an elevated session payload using HMAC-SHA256.
 */
function signPayload(payloadStr: string): string {
  return crypto.createHmac("sha256", getSecretKey()).update(payloadStr).digest("hex");
}

/**
 * Issues or rotates an elevated session cookie for the verified admin.
 */
export async function issueAdminElevatedSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ABSOLUTE_TIMEOUT_SECONDS;
  const lastActive = now;
  const nonce = crypto.randomBytes(16).toString("hex");

  const payload: ElevatedSessionPayload = {
    userId,
    issuedAt: now,
    expiresAt,
    lastActive,
    nonce,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(payloadStr);
  const cookieValue = `${payloadStr}.${signature}`;

  cookieStore.set(ADMIN_ELEVATED_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ABSOLUTE_TIMEOUT_SECONDS,
    path: "/", // Available to /admin, server actions, and /api routes
  });
}

/**
 * Validates the elevated admin session for the specified user.
 * Enforces signature integrity, user binding, absolute timeout, and idle timeout.
 */
export async function verifyAdminElevatedSession(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(ADMIN_ELEVATED_COOKIE)?.value;
  if (!cookie) return false;

  const parts = cookie.split(".");
  if (parts.length !== 2) return false;

  const payloadStr = parts[0];
  const signature = parts[1];
  if (!payloadStr || !signature) return false;

  const expectedSignature = signPayload(payloadStr);

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  const isValidSignature = crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );

  if (!isValidSignature) return false;

  try {
    const payload: ElevatedSessionPayload = JSON.parse(
      Buffer.from(payloadStr, "base64url").toString("utf-8")
    );

    const now = Math.floor(Date.now() / 1000);

    // 1. User binding check
    if (payload.userId !== userId) return false;

    // 2. Absolute timeout check
    if (now > payload.expiresAt) return false;

    // 3. Idle timeout check
    if (now > payload.lastActive + IDLE_TIMEOUT_SECONDS) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Revokes the elevated admin session cookie on logout or invalidation.
 */
export async function revokeAdminElevatedSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: ADMIN_ELEVATED_COOKIE,
    path: "/",
  });
}

/**
 * Server-side guard that verifies:
 * 1. An authenticated identity exists.
 * 2. The account has PLATFORM_ADMIN role.
 * 3. The user has an active, verified MFA elevated session.
 *
 * Redirects or throws if any check fails.
 */
export async function assertSuperAdminWithMFA(): Promise<{
  user: { id: string; email?: string };
  profile: { platform_role: string; full_name?: string };
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, platform_role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.platform_role !== "PLATFORM_ADMIN") {
    redirect("/403");
  }

  const admin = createAdminClient();
  const { data: mfaRecord } = await admin
    .from("admin_mfa")
    .select("mfa_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!mfaRecord?.mfa_enabled) {
    redirect("/admin/setup-2fa");
  }

  const isMfaVerified = await verifyAdminElevatedSession(user.id);
  if (!isMfaVerified) {
    redirect("/admin/verify");
  }

  return { user, profile };
}

/**
 * Non-throwing check for Server Actions. Returns `{ user, profile }` on success,
 * or `{ error: string }` if unauthorized or unverified.
 */
export async function getSuperAdminWithMFA(): Promise<
  | { user: { id: string; email?: string }; profile: { platform_role: string; full_name?: string } }
  | { error: string }
> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Admin login required. Please sign in to Sweetly Console." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, platform_role, full_name")
      .eq("id", user.id)
      .single();

    if (!profile || profile.platform_role !== "PLATFORM_ADMIN") {
      return { error: "Access denied. Only platform administrators can perform this action." };
    }

    const admin = createAdminClient();
    const { data: mfaRecord } = await admin
      .from("admin_mfa")
      .select("mfa_enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!mfaRecord?.mfa_enabled) {
      return { error: "Admin 2FA is required. Please complete 2FA setup first." };
    }

    const isMfaVerified = await verifyAdminElevatedSession(user.id);
    if (!isMfaVerified) {
      return { error: "Admin session expired. Please re-verify 2FA at /admin/verify." };
    }

    return { user, profile };
  } catch (err: any) {
    return { error: err?.message || "Failed to authenticate administrator." };
  }
}

