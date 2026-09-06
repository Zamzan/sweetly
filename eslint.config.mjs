import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

// Next.js 16's eslint-config-next ships native ESLint flat config
// (no FlatCompat adapter needed) — this is the current documented
// setup at nextjs.org/docs/basic-features/eslint.
const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
