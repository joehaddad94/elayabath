import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Tests cover pure logic only: parsing, ranking, grouping, formatting. There
 * are no component tests, because nothing here has interesting render
 * behaviour that the type system and the browser audit do not already cover,
 * and a jsdom harness would be more machinery than the coverage is worth.
 *
 * The `@/` alias is declared here rather than pulled in through another
 * package, since it is one line and this repo keeps its dependency list short.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
