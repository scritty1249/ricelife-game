import { build } from "esbuild";
import { existsSync, statSync, readdirSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import { resolveAbsolutePathsPluginFactory } from "./utils.js";

const isDev = process.argv.includes("--dev");

const outputPath = path.normalize("./client");
const ammoPath = path.normalize("./src/engine/ammotypes");
const webWorkerSource = path.normalize("./src/engine/workers/Worker.js");
const runtimeCoreSource = path.normalize("./src/engine/runtime/Core.js");
const clientScriptSource = path.normalize("./src/client/scripts/main.js");

const entryPoints = {
    "engine/runtime/Core": runtimeCoreSource,
    "engine/workers/Worker": webWorkerSource,
    "scripts/main": clientScriptSource
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

if (existsSync(ammoPath)) {
    const ammoFiles = readdirSync(ammoPath)
        .map(file => path.join(ammoPath, file))
        .filter(filePath => statSync(filePath).isFile());
    ammoFiles.forEach(filePath => {
        const filename = path.parse(filePath).name;
        entryPoints[`engine/ammotypes/${filename}`] = filePath;
    });
} else {
    console.error(`Error: ammo types directory not found at: ${ammoPath}`);
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
const mainBundleName = outputFiles.find(file => file.endsWith(".js") && file.startsWith("client/scripts/main-"));
if (!mainBundleName) {
    throw new Error("Could not find generated entry point bundle file.");
}
const bundleUrl = "/" + path.relative(outputPath, mainBundleName).replace(/\\/g, "/");
const indexFileSource = path.normalize("./src/client/index.html");
const indexFileOutput = path.normalize("./client/index.html");
console.log(`Copying index file with bundle ${bundleUrl} from ${indexFileSource} to ${indexFileOutput}`);
const bundleScriptTag = `<script type="module" src="${bundleUrl}" defer></script>`;
let htmlContent = readFileSync(indexFileSource, "utf8");
htmlContent = htmlContent.replace("<!-- SCRIPT_BUNDLE_TAG -->", bundleScriptTag);
writeFileSync(indexFileOutput, htmlContent, "utf8");

console.log(`Successfully wrote index file to ${indexFileOutput}`);
process.exit(0);
