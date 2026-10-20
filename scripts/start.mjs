import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

process.env.NODE_ENV = "production";
process.env.PORT = process.env.PORT || "3011";
process.env.HOSTNAME = process.env.HOSTNAME || "127.0.0.1";

const serverPath = join(process.cwd(), ".next", "standalone", "server.js");

if (!existsSync(serverPath)) {
  console.error(`start: falta ${serverPath} — ejecuta \`npm run build\` primero.`);
  process.exit(1);
}

await import(pathToFileURL(serverPath).href);
