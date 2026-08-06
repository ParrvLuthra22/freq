// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Deno edge functions use URL imports and a separate runtime — not part
    // of the app's Node/RN module graph.
    ignores: ["dist/*", "supabase/functions/**"],
  }
]);
