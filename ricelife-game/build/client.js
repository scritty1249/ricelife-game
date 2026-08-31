import { build } from "esbuild";
import { existsSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import { resolveAbsolutePathsPluginFactory } from "./utils.js";

const isDev = process.argv.includes("--dev");
const GIT_COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA || "?".repeat(40);

const outputPath = path.normalize("./client");
const webWorkerSource = path.normalize("./src/engine/workers/Worker.js");
const webWorkerOutput = "engine/workers/Worker";
const clientScriptOutput = "scripts/main";
const runtimeCoreSource = path.normalize("./src/engine/runtime/Core.js");
const clientScriptSource = path.normalize("./src/client/scripts/main.js");

const entryPoints = {
    "engine/runtime/Core": runtimeCoreSource,
    [webWorkerOutput]: webWorkerSource,
    [clientScriptOutput]: clientScriptSource
};
const externalPrefixes = [
    "/data/*",
    "/assets/*"
];

for (const [ dest, src ] of Object.entries(entryPoints)) {
    if (!existsSync(src)) {
        console.error(`Error: Source for ${dest} not found at: ${src}`);
        process.exit(1);
    }
}

console.log(`Clustering ${Object.values(entryPoints).length} sources:\n`);
const result = await build({
    entryPoints,
    bundle: true,
    write: true,
    minify: !isDev,
    format: "esm",
    splitting: true,
    outdir: outputPath,
    entryNames: "[dir]/[name]-[hash]",
    chunkNames: "scripts/chunks/[name]-[hash]", 
    metafile: true,
    plugins: [resolveAbsolutePathsPluginFactory(...externalPrefixes)],
    external: externalPrefixes,
});
console.log(`\nSuccessfully build to: ${outputPath}`);

const outputFiles = Object.keys(result.metafile.outputs);
const mainBundleName = outputFiles.find(file => file.endsWith(".js") && file.startsWith(`client/${clientScriptOutput}-`));
const webWorkerName = outputFiles.find(file => file.endsWith(".js") && file.startsWith(`client/${webWorkerOutput}-`));
if (!mainBundleName) throw new Error("Could not find generated entry point bundle file.");
if (!webWorkerName) throw new Error("Could not find generated web worker file.");
const bundleUrl = "/" + path.relative(outputPath, mainBundleName).replace(/\\/g, "/");
const workerUrl = "/" + path.relative(outputPath, webWorkerName).replace(/\\/g, "/");
const indexFileSource = path.normalize("./src/client/index.html");
const indexFileOutput = path.normalize("./client/index.html");
console.log(`Copying index file from ${indexFileSource}`);
const bundleScriptTag = `<script type="module" src="${bundleUrl}" defer></script>`;
let htmlContent = readFileSync(indexFileSource, "utf8");
htmlContent = htmlContent
    .replace("<!-- SCRIPT_BUNDLE_TAG -->", bundleScriptTag)
    .replace("<!-- GIT_COMMIT_SHA -->", GIT_COMMIT_SHA)
    .replace("<!-- GENERATED_WORKER_URL -->", workerUrl);
writeFileSync(indexFileOutput, htmlContent, "utf8");

console.log(`Successfully wrote index file to ${indexFileOutput}`);
process.exit(0);
