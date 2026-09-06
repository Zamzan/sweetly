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
  const host = request.headers.get("host");

  // If Sec-Fetch-Site is present, check for cross-site
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite === "cross-site") {
    return { valid: false, reason: "Cross-site request blocked by CSRF protection." };
  }

  // If origin header exists, verify origin matches host
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (host && originHost === host) {
        return { valid: true };
      }
      // Allow localhost in development
      if (
        process.env.NODE_ENV !== "production" &&
        (originHost.startsWith("localhost") || originHost.startsWith("127.0.0.1"))
      ) {
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
      if (host && refererHost === host) {
        return { valid: true };
      }
      if (
        process.env.NODE_ENV !== "production" &&
        (refererHost.startsWith("localhost") || refererHost.startsWith("127.0.0.1"))
      ) {
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
