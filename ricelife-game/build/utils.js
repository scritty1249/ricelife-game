import path from "path";

const root = path.resolve(process.cwd(), "./src/");
export const resolveAbsolutePathsPlugin = {
    name: "resolve-absolute-paths",
    setup (build) {
        build.onResolve({ filter: /^\// }, args => {
            return {
                path: path.join(root, args.path),
            }
        });
    },
};
