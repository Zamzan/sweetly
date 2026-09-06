import { z } from "zod";

/**
 * Central validation. Every server action / route handler that
 * accepts client input MUST parse it through one of these schemas
 * before touching the database. Never trust browser-side validation
 * alone (rule #25 / #26 of the spec).
 */

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug must be at least 3 characters")
  .max(60, "Slug must be under 60 characters")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only");

export const RESERVED_SLUGS = new Set([
  "login", "signup", "dashboard", "admin", "api", "settings", "pricing",
  "about", "contact", "support", "terms", "privacy", "shops",
  "forgot-password", "reset-password", "onboarding",
]);

export function normalizePhone(val: unknown): string {
  if (typeof val !== "string") return "";
  // Strip all non-digit characters (removes letters, emojis, spaces, punctuation)
  let cleaned = val.replace(/\D/g, "");
  // If user entered with 91 prefix (12 digits starting with 91), strip it
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.length === 11 && cleaned.startsWith("0")) {
    // If user entered with leading 0 (11 digits starting with 0), strip it
    cleaned = cleaned.slice(1);
  }
  // Strictly enforce max 10 digits
  if (cleaned.length > 10) {
    cleaned = cleaned.slice(0, 10);
  }
  return cleaned;
}

const emptyToNull = (val: unknown) => {
  if (val === "" || val === undefined || val === "null") return null;
  return typeof val === "string" ? val.trim() : val;
};

// Indian mobile number validation (standard 10-digit mobile number, no country code required).
export const phoneSchema = z.preprocess(
  (val) => (typeof val === "string" && val.trim() ? normalizePhone(val) : val),
  z
    .string()
    .regex(
      /^[6-9]\d{9}$/,
      "Enter a valid 10-digit Indian mobile number (e.g. 9876543210)"
    )
);

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "tempmail.com", "temp-mail.org", "mailinator.com", "10minutemail.com",
  "guerrillamail.com", "throwawaymail.com", "sharklasers.com", "yopmail.com",
  "trashmail.com", "getairmail.com", "dispostable.com", "maildrop.cc",
  "crazymailing.com", "fakeinbox.com", "generator.email", "mohmal.com",
  "inboxbear.com", "dropmail.me", "fakemailgenerator.com", "burnermail.io",
]);

export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return Boolean(domain && DISPOSABLE_EMAIL_DOMAINS.has(domain));
}

export const signupSchema = z.object({
  ownerName: z.string().trim().min(2, "Owner name must be at least 2 characters").max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(255)
    .refine((val) => !isDisposableEmail(val), {
      message: "Temporary or disposable email addresses are not permitted. Please use a valid personal or business email.",
    }),
  phone: phoneSchema,
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  shopName: z.string().trim().min(2, "Shop name must be at least 2 characters").max(80),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const shopSettingsSchema = z.object({
  name: z.string().trim().min(2, "Store name must be at least 2 characters").max(80),
  description: z.preprocess(emptyToNull, z.string().max(2000).optional().nullable()),
  whatsappNumber: phoneSchema,
  phone: z.preprocess(
    (val) => (typeof val === "string" && val.trim() ? normalizePhone(val) : null),
    z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number").optional().nullable()
  ),
  address: z.preprocess(emptyToNull, z.string().max(300).optional().nullable()),
  city: z.preprocess(emptyToNull, z.string().max(100).optional().nullable()),
  state: z.preprocess(emptyToNull, z.string().max(100).optional().nullable()),
  pincode: z.preprocess(
    emptyToNull,
    z.string().regex(/^\d{4,10}$/, "Enter a valid pincode").optional().nullable()
  ),
  googleMapsUrl: z.preprocess(
    emptyToNull,
    z.string().url("Enter a valid map link (e.g. https://maps.google.com/...)").optional().nullable()
  ),
  customOrderEnabled: z.coerce.boolean().default(true),
  customOrderButtonText: z.preprocess(
    emptyToNull,
    z.string().max(60).optional().nullable()
  ),
  customOrderTitle: z.preprocess(
    emptyToNull,
    z.string().max(160).optional().nullable()
  ),
  customOrderDescription: z.preprocess(
    emptyToNull,
    z.string().max(1000).optional().nullable()
  ),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(60),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(120),
  description: z.preprocess(emptyToNull, z.string().max(3000).optional().nullable()),
  price: z.coerce.number().min(0, "Price must be zero or higher").max(1_000_000),
  categoryId: z.preprocess(
    (val) => (!val || val === "" || val === "none" ? null : val),
    z.string().uuid("Invalid category").optional().nullable()
  ),
  available: z.boolean().default(true),
  featured: z.boolean().default(false),
});

export const customOrderSchema = z.object({
  shopSlug: slugSchema,
  customerName: z.string().trim().min(1).max(120),
  customerPhone: phoneSchema,
  occasion: z.string().trim().max(120).optional().nullable(),
  productType: z.string().trim().max(120).optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(100000).optional().nullable(),
  budgetPerUnit: z.coerce.number().min(0).max(1_000_000).optional().nullable(),
  totalBudget: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  desiredDate: z.string().date().optional().nullable(),
  instructions: z.string().trim().max(2000).optional().nullable(),
});

// Uploaded reference images: type/size validated here; content is
// re-checked server-side (magic-byte sniffing) before storage write.
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_IMAGES_PER_UPLOAD = 5;

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
