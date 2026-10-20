import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.error("postbuild: falta .next/standalone — ejecuta `npm run build` (next build con output standalone).");
  process.exit(1);
}

const copies = [
  [join(root, ".next", "static"), join(standalone, ".next", "static")],
  [join(root, "public"), join(standalone, "public")],
];

for (const [src, dest] of copies) {
  if (!existsSync(src)) {
    console.error(`postbuild: falta ${src}`);
    process.exit(1);
  }
  cpSync(src, dest, { recursive: true, force: true });
  console.log(`postbuild: ${src} -> ${dest}`);
}
