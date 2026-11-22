import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([".next/**", ".qa/**", ".local/**", ".worktrees/**", "src/generated/**", "node_modules/**", "next-env.d.ts"]),
]);
