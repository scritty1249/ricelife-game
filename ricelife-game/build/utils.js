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
