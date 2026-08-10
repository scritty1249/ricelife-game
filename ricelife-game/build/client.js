import { build } from "esbuild";
import { existsSync, statSync, readdirSync } from "fs";
import path from "path";
import { resolveAbsolutePathsPlugin } from "./utils.js";

const isDev = process.argv.includes("--dev");
const outDir = path.normalize("./dist/engine");

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
process.exit(0);
