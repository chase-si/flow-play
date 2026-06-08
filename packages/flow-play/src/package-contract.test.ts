import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "../..");

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

interface PackageJson {
  devDependencies?: Record<string, string>;
  exports?: Record<string, { import: string; require: string; types: string }>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

describe("package build contract", () => {
  it("publishes the headless and React Flow entrypoints in ESM, CJS, and types", async () => {
    const packageJson = await readJson<PackageJson>(resolve(packageRoot, "package.json"));

    expect(packageJson.exports).toEqual({
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
        require: "./dist/index.cjs"
      },
      "./react-flow": {
        types: "./dist/react-flow.d.ts",
        import: "./dist/react-flow.js",
        require: "./dist/react-flow.cjs"
      }
    });
    expect(packageJson.scripts?.build).toContain("tsup src/index.ts src/react-flow.ts");
    expect(packageJson.scripts?.build).toContain("--format esm,cjs");
    expect(packageJson.scripts?.build).toContain("--emitDeclarationOnly");
  });

  it("keeps React integrations as peers and external to the bundled output", async () => {
    const packageJson = await readJson<PackageJson>(resolve(packageRoot, "package.json"));
    const buildScript = packageJson.scripts?.build ?? "";

    expect(packageJson.peerDependencies).toMatchObject({
      "@xyflow/react": expect.any(String),
      react: expect.any(String),
      "react-dom": expect.any(String)
    });
    expect(buildScript).toContain("--external react");
    expect(buildScript).toContain("--external react-dom");
    expect(buildScript).toContain("--external @xyflow/react");
  });

  it("exposes maintainer build and manual release commands from the workspace root", async () => {
    const workspacePackageJson = await readJson<PackageJson>(
      resolve(workspaceRoot, "package.json")
    );
    const changesetConfig = await readJson<{ access: string; baseBranch: string }>(
      resolve(workspaceRoot, ".changeset/config.json")
    );

    expect(workspacePackageJson.scripts).toMatchObject({
      "package:check": "pnpm --filter flow-play build",
      changeset: "pnpm dlx @changesets/cli",
      version: "pnpm dlx @changesets/cli version",
      release: "pnpm package:check && pnpm dlx @changesets/cli publish"
    });
    expect(changesetConfig).toMatchObject({
      access: "public",
      baseBranch: "main"
    });
  });
});
