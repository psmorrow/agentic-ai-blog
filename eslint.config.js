import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["**/*.test.js", "node_modules/", "coverage/", "posts/", "metrics/"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  }
];
