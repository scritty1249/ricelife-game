import { build } from "esbuild";
import { existsSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import { GIT_COMMIT_SHA, DEV_FLAG, resolveAbsolutePathsPluginFactory, resolveSourcePathsPluginFactory } from "./utils.js";

const outputPath = path.normalize("./client");
const webWorkerSource = path.normalize("./src/engine/workers/Worker.js");
const webWorkerOutput = "scripts/engine/Worker";
const clientScriptOutput = "scripts/main";
const runtimeCoreSource = path.normalize("./src/engine/runtime/Core.js");
const runtimeCoreOutput = "scripts/engine/Core";
const clientScriptSource = path.normalize("./src/client/scripts/main.js");
const stylesheetSource = path.normalize("./src/client/stylesheets/styles.css");

const HTML_REPLACE_TAGS = {
    GIT_COMMIT_SHA: GIT_COMMIT_SHA
};

const entryPoints = {
    [runtimeCoreOutput]: runtimeCoreSource,
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

// JS
console.log(`Clustering ${Object.values(entryPoints).length} sources:\n`);
const scriptResult = await build({
    entryPoints,
    bundle: true,
    write: true,
    minify: !DEV_FLAG,
    format: "esm",
    splitting: true,
    outdir: outputPath,
    entryNames: "[dir]/[name]-[hash]",
    chunkNames: "scripts/shared/[name]-[hash]", 
    metafile: true,
    plugins: [
        resolveAbsolutePathsPluginFactory(...externalPrefixes),
        resolveSourcePathsPluginFactory("$")
    ],
    external: externalPrefixes,
});
console.log(`\nSuccessfully built to: ${outputPath}`);
const outputFiles = Object.keys(scriptResult.metafile.outputs);
const mainBundleName = outputFiles.find(file => file.endsWith(".js") && file.startsWith(`client/${clientScriptOutput}-`));
const webWorkerName = outputFiles.find(file => file.endsWith(".js") && file.startsWith(`client/${webWorkerOutput}-`));
if (!mainBundleName) throw new Error("Could not find generated entry point bundle file.");
if (!webWorkerName) throw new Error("Could not find generated web worker file.");
const bundleUrl = "/" + path.relative(outputPath, mainBundleName).replace(/\\/g, "/");
HTML_REPLACE_TAGS.GENERATED_WORKER_URL = "/" + path.relative(outputPath, webWorkerName).replace(/\\/g, "/");
HTML_REPLACE_TAGS.SCRIPT_BUNDLE_TAG = `<script type="module" src="${bundleUrl}" defer></script>`;

// CSS
console.log(`Bundling stylesheet:\n${stylesheetSource}`);
const styleResult = await build({
    entryPoints: [stylesheetSource], 
    bundle: true,
    minify: !DEV_FLAG,
    outdir: outputPath,
    entryNames: "stylesheets/[dir]/[name]-[hash]",
    metafile: true
});
console.log(`\nSuccessfully bundled to: ${outputPath}`);
const outputStylesheet = Object.keys(styleResult.metafile.outputs)[0];
const stylesheetUrl = "/" + path.relative(outputPath, outputStylesheet).replace(/\\/g, "/");
HTML_REPLACE_TAGS.STYLE_BUNDLE_TAG = `<link rel="stylesheet" href="${stylesheetUrl}"/>`;

// HTML
const indexFileSource = path.normalize("./src/client/index.html");
const indexFileOutput = path.normalize("./client/index.html");
console.log(`Copying index file from ${indexFileSource}`);
let htmlContent = readFileSync(indexFileSource, "utf8");
for (const [ find, replace ] of Object.entries(HTML_REPLACE_TAGS)) {
    htmlContent = htmlContent.replace(`<!-- ${find} -->`, replace);
}
writeFileSync(indexFileOutput, htmlContent, "utf8");
console.log(`Successfully wrote index file to ${indexFileOutput}`);
process.exit(0);
