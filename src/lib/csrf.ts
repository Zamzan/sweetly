import "server-only";
import { type NextRequest } from "next/server";

/**
 * CSRF / Origin verification for API routes.
 *
 * Checks that state-changing requests (POST, PUT, DELETE, PATCH)
 * originate from the same host or a legitimate configured host.
 */
export function verifySameOrigin(request: NextRequest): { valid: boolean; reason?: string } {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return { valid: true };
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host");

  // If Sec-Fetch-Site is present, check for cross-site
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite === "cross-site") {
    return { valid: false, reason: "Cross-site request blocked by CSRF protection." };
  }

  const allowedHosts = new Set<string>();
  if (hostHeader) {
    const clean = hostHeader.split(":")[0]?.toLowerCase();
    if (clean) allowedHosts.add(clean);
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      allowedHosts.add(new URL(process.env.NEXT_PUBLIC_APP_URL).hostname.toLowerCase());
    } catch {}
  }
  if (process.env.VERCEL_URL) {
    const clean = process.env.VERCEL_URL.split(":")[0]?.toLowerCase();
    if (clean) allowedHosts.add(clean);
  }
  if (process.env.VERCEL_BRANCH_URL) {
    const clean = process.env.VERCEL_BRANCH_URL.split(":")[0]?.toLowerCase();
    if (clean) allowedHosts.add(clean);
  }

  function isHostAllowed(testHostWithPort: string): boolean {
    const testHost = testHostWithPort.split(":")[0]?.toLowerCase() || "";
    if (!testHost) return false;
    if (allowedHosts.has(testHost)) return true;

    // Allow localhost / 127.0.0.1 in local development
    if (
      process.env.NODE_ENV !== "production" &&
      (testHost === "localhost" || testHost === "127.0.0.1")
    ) {
      return true;
    }

    // Allow vercel preview / production deployment subdomains for brightly / sweetly
    if (testHost.endsWith(".vercel.app") && (testHost.includes("sweetly") || testHost.includes("sweetlyy"))) {
      return true;
    }

    return false;
  }

  // If origin header exists, verify origin matches host
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (isHostAllowed(originHost)) {
        return { valid: true };
      }
      return { valid: false, reason: `Invalid origin: ${originHost}` };
    } catch {
      return { valid: false, reason: "Malformed origin header" };
    }
  }

  // Fallback to referer header if origin is absent
  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (isHostAllowed(refererHost)) {
        return { valid: true };
      }
      return { valid: false, reason: `Invalid referer: ${refererHost}` };
    } catch {
      return { valid: false, reason: "Malformed referer header" };
    }
  }

  // Fallback: no Origin and no Referer header at all. Modern browsers
  // send at least one of these on every cross-origin state-changing
  // request, so a state-changing request with neither is unusual
  // enough to treat as suspicious rather than assume same-origin.
  // Fail closed, not open — legitimate same-origin fetch() calls and
  // Server Actions from this app always send an Origin header, so
  // this should not affect real usage.
  return { valid: false, reason: "Missing origin/referer headers on state-changing request." };
}
