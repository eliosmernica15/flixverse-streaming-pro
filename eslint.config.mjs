import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  // eslint-config-next v16 ships native flat config — no FlatCompat needed
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // The player/party sync layer intentionally uses non-null assertions
      // and mutable refs behind stable callback identities.
      "@typescript-eslint/no-non-null-assertion": "off",
      // Unused code is noisy in this codebase; report as warning, not CI failure.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      // eslint-plugin-react-hooks v7 ships React Compiler-era diagnostics as
      // errors. This codebase does not use the React Compiler and sets state
      // from data-fetching effects pervasively, so those rules are advisory
      // warnings rather than CI failures. Correctness rules
      // (rules-of-hooks, exhaustive-deps) remain errors.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default eslintConfig;
