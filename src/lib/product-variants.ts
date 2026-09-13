/**
 * Universal product variant parser and description sanitizer.
 *
 * Automatically detects and parses resiliently embedded variants:
 * `<!--sweetly_variants:[{"id":"v-1","name":"Half Kg","size":"500g","price":650,"available":true},...]-->`
 *
 * Ensures that:
 * 1. Variants, sizes, colors, and prices are restored across any PostgreSQL schema level.
 * 2. Raw `<!--sweetly_variants:...-->` is completely stripped from user-facing descriptions.
 */

export interface ProductVariantItem {
  id: string;
  name: string;
  size?: string | null;
  color?: string | null;
  price: number;
  available?: boolean;
}

export interface ParsedProductData {
  cleanDescription: string;
  variants: ProductVariantItem[];
  sizes: string[];
  colors: string[];
}

export function parseProductVariants(
  rawDescription?: string | null,
  existingVariants?: any[] | null,
  existingSizes?: string[] | null,
  existingColors?: string[] | null
): ParsedProductData {
  let cleanDescription = rawDescription || "";
  let variants: ProductVariantItem[] =
    Array.isArray(existingVariants) && existingVariants.length > 0 ? existingVariants : [];

  const variantMarker = "<!--sweetly_variants:";
  if (cleanDescription.includes(variantMarker)) {
    try {
      const markerStart = cleanDescription.indexOf(variantMarker);
      const markerEnd = cleanDescription.indexOf("-->", markerStart);
      if (markerEnd !== -1) {
        const jsonStr = cleanDescription.slice(markerStart + variantMarker.length, markerEnd);
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          variants = parsed;
        }
      }
    } catch (e) {
      console.warn("Failed parsing embedded variants:", e);
    }
  }

  // Strip any variant comments from the visible description
  cleanDescription = cleanDescription.replace(/<!--sweetly_variants:[\s\S]*?-->/g, "").trim();

  const sizes: string[] =
    Array.isArray(existingSizes) && existingSizes.length > 0
      ? existingSizes
      : Array.from(new Set(variants.map((v) => v.size).filter(Boolean) as string[]));

  const colors: string[] =
    Array.isArray(existingColors) && existingColors.length > 0
      ? existingColors
      : Array.from(new Set(variants.map((v) => v.color).filter(Boolean) as string[]));

  return {
    cleanDescription,
    variants,
    sizes,
    colors,
  };
}
