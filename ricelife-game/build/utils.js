import path from "path";
import { writeFileSync, readFileSync } from "fs";

export function resolveAbsolutePathsPluginFactory (...externalPrefixes) {
    const root = path.resolve(process.cwd(), "./src/");
    return {
        name: "resolve-absolute-paths",
        setup (build) {
            if (externalPrefixes.length > 0) {
                const prefixes = externalPrefixes
                    .map(p => p.replace(/^\/|\/\*$/g, ""))
                    .join("|");
                const externalFilter = new RegExp(`^\\/(${prefixes})\\/`);
                build.onResolve({ filter: externalFilter }, (args) => {
                    return { 
                        path: args.path,
                        external: true
                    };
                });
            }
            build.onResolve({ filter: /^\// }, args => {
                return {
                    path: path.join(root, args.path),
                }
            });
        },
    };
}

export function injectOutputFilenamePluginFactory (replaceStr, filterCondition = (outputFile) => true) {
    return {
        name: "inject-output-name",
        setup (build) {
            build.onEnd((result) => {
                if (result.errors.length > 0 || !result.metafile) return;
                const outputs = Object.keys(result.metafile.outputs);
                outputs.forEach((outputFile) => {
                    const isScript = outputFile.endsWith(".js");
                    const isTarget = filterCondition?.(outputFile) ?? false;
                    if (isScript && isTarget) {
                        const fileName = outputFile.match(/^[\/\S]+\/(.*)\.js$/)?.[1];
                        if (!fileName) return;
                        let content = readFileSync(outputFile, "utf8");
                        if (content.includes(replaceStr)) {
                            content = content.replaceAll(replaceStr, fileName);
                            writeFileSync(outputFile, content, "utf8");
                        }
                    }
                });
            });
        }
    };
}