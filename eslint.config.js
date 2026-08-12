import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: [
      "coverage/",
      "node_modules/",
      "playwright-report/",
      "test-results/",
      "local-md.js",
      "*.map",
      "bookmark.js",
      "build-bookmarklet.mjs",
      "build.mjs",
      "scripts/*.mjs",
      "eslint.config.js",
    ],
  },
);
