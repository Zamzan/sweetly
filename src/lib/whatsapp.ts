/**
 * WhatsApp Click-to-Chat link generation.
 *
 * IMPORTANT SECURITY NOTE (see spec sections 13–14):
 * The destination phone number must ALWAYS come from the shop's
 * stored `whatsapp_number` column (fetched server-side / from a
 * trusted query), never from a query string, form field, or any
 * other client-controlled input. Callers of buildWhatsAppLink()
 * must pass the number they loaded from the database — this
 * function does not fetch it itself, but it does normalize and
 * validate the format so a malformed value can't produce a broken
 * or hijacked wa.me link.
 *
 * This is Click-to-Chat only: the customer's device opens WhatsApp
 * with a pre-filled message, and the customer must press Send.
 * Nothing here sends a message automatically or silently.
 */

export class InvalidWhatsAppNumberError extends Error {}

/** Normalizes a stored number to digits-only, no leading +, for wa.me. */
export function normalizeWhatsAppNumber(rawNumber: string): string {
  let digits = rawNumber.replace(/[^\d]/g, "");
  // If stored as standard Indian 10-digit number, prepend 91 for wa.me API routing
  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = `91${digits.slice(1)}`;
  }

  if (digits.length < 10 || digits.length > 15) {
    throw new InvalidWhatsAppNumberError(
      "Shop WhatsApp number is not configured correctly."
    );
  }
  return digits;
}

export interface CustomOrderMessageFields {
  shopName: string;
  customerName: string;
  customerPhone: string;
  occasion?: string | null;
  productType?: string | null;
  quantity?: number | null;
  budgetPerUnit?: number | null;
  desiredDate?: string | null;
  instructions?: string | null;
}

/** Builds the human-readable message body. Plain text only — no HTML. */
export function buildCustomOrderMessage(fields: CustomOrderMessageFields): string {
  const lines = [
    "New Custom Order from Sweetly Website",
    "",
    `Shop: ${fields.shopName}`,
    "",
    `Customer Name: ${fields.customerName}`,
    `Customer Phone: ${fields.customerPhone}`,
  ];

  if (fields.occasion) lines.push(`Occasion: ${fields.occasion}`);
  if (fields.productType) lines.push(`Product Type: ${fields.productType}`);
  if (fields.quantity) lines.push(`Quantity: ${fields.quantity}`);
  if (fields.budgetPerUnit) lines.push(`Budget Per Unit: Rs. ${fields.budgetPerUnit}`);
  if (fields.desiredDate) lines.push(`Desired Date: ${fields.desiredDate}`);
  if (fields.instructions) lines.push(`Special Instructions: ${fields.instructions}`);

  lines.push("", "Please contact the customer to confirm the order.");
  return lines.join("\n");
}

export interface CartOrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface CartOrderMessageFields {
  shopName: string;
  items: CartOrderItem[];
  total: number;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  notes?: string;
}

/** Builds the human-readable multi-item order message for WhatsApp. */
export function buildCartOrderMessage(fields: CartOrderMessageFields): string {
  const lines = [
    `*New Order from ${fields.shopName} Website*`,
    "",
    "*Order Items:*",
  ];

  fields.items.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    lines.push(
      `${index + 1}. ${item.name} x ${item.quantity} = Rs. ${itemTotal.toLocaleString("en-IN")}`
    );
  });

  lines.push("", `*Total Amount:* Rs. ${fields.total.toLocaleString("en-IN")}`);

  if (fields.customerName) lines.push(`*Customer Name:* ${fields.customerName}`);
  if (fields.customerPhone) lines.push(`*Customer Phone:* ${fields.customerPhone}`);
  if (fields.deliveryAddress) lines.push(`*Delivery / Address:* ${fields.deliveryAddress}`);
  if (fields.notes) lines.push(`*Special Notes / Instructions:* ${fields.notes}`);

  lines.push("", "Please confirm availability and order fulfillment. Thank you!");
  return lines.join("\n");
}

/**
 * Builds a safe wa.me URL. `shopWhatsAppNumber` MUST be the value
 * loaded from the shop's own database row — never accept this as a
 * parameter sourced from request query/body.
 */
export function buildWhatsAppLink(shopWhatsAppNumber: string, message: string): string {
  const number = normalizeWhatsAppNumber(shopWhatsAppNumber);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${encoded}`;
}
