import { build } from "esbuild";
import { existsSync, statSync, readdirSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import { resolveAbsolutePathsPlugin } from "./utils.js";

const isDev = process.argv.includes("--dev");
const outDir = path.normalize("./client/engine");

const ammoPath = path.normalize("./src/engine/ammotypes");
const webWorkerSource = path.normalize("./src/engine/workers/Worker.js");
const runtimeCoreSource = path.normalize("./src/engine/runtime/Core.js");

const entryPoints = {
    "runtime/Core": runtimeCoreSource,
    "workers/Worker": webWorkerSource
};

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
        entryPoints[`ammotypes/${filename}`] = filePath;
    });
} else {
    console.error(`Error: ammo types directory not found at: ${ammoPath}`);
}

console.log(`Clustering ${Object.values(entryPoints).length} client assets with entry points:\n`);
for (const [ dest, src ] of Object.entries(entryPoints)) {
    console.log(`Bundling: ${src} > ${dest}`);
}

await build({
    entryPoints,
    bundle: true,
    write: true,
    minify: !isDev,
    format: "esm",
    splitting: true, // split shared code bits into chunks
    outdir: outDir,
    plugins: [resolveAbsolutePathsPlugin],
});
console.log(`\nSuccessfully built to: ${outDir}`);

const clientScriptSource = path.normalize("./src/client/scripts/main.js");
const clientScriptOutput = path.normalize("./client/scripts/");
console.log(`Bundling client scripts at: ${clientScriptSource}`);
const result = await build({
    entryPoints: [clientScriptSource],
    outdir: clientScriptOutput,
    bundle: true,
    write: true,
    minify: !isDev,
    format: "esm",
    splitting: true, // split shared code bits into chunks
    entryNames: "[name]-[hash]",
    metafile: true,
    external: [
        "/engine/*",
        "/data/*",
        "/assets/*"
    ],
})
console.log(`\nSuccessfully built to: ${clientScriptOutput}`);

const indexFileSource = path.normalize("./src/client/index.html");
const indexFileOutput = path.normalize("./client/index.html");
const outputFiles = Object.keys(result.metafile.outputs);
const bundleName = outputFiles.find(file => file.endsWith(".js") && file.startsWith("client/scripts/main-"));
if (!bundleName) {
    throw new Error("Could not find generated entry point bundle file.");
}
const bundleUrl = "/" + path.relative("./client", bundleName).replace(/\\/g, "/");
console.log(`Writing index file with bundle ${bundleUrl} from ${indexFileSource} to ${indexFileOutput}`);
const bundleScriptTag = `<script type="module" src="${bundleUrl}" defer></script>`;
let htmlContent = readFileSync(indexFileSource, "utf8");
htmlContent = htmlContent.replace("<!-- SCRIPT_BUNDLE_TAG -->", bundleScriptTag);
writeFileSync(indexFileOutput, htmlContent, "utf8");
console.log(`Sucessfully wrote to ${indexFileOutput}`);

process.exit(0);
