const esbuild = require("esbuild");

const isProduction = process.argv.includes("--production");
const isWatch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],   // vscode is provided by the extension host — never bundle it
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: !isProduction,
  minify: isProduction,
  // Allow esbuild to resolve ESM-only packages (like @opencode-ai/sdk)
  conditions: ["import", "module", "default"],
  mainFields: ["module", "main"],
};

if (isWatch) {
  esbuild.context(buildOptions).then((ctx) => {
    ctx.watch();
    console.log("Watching for changes...");
  });
} else {
  esbuild.build(buildOptions).then(() => {
    console.log(`Built dist/extension.js (production=${isProduction})`);
  }).catch(() => process.exit(1));
}
