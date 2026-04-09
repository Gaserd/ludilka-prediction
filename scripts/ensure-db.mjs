import { spawnSync } from "node:child_process";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const targetUrl = new URL(databaseUrl);
const databaseName = targetUrl.pathname.replace(/^\//, "");

if (!databaseName) {
  console.error("DATABASE_URL must include a database name.");
  process.exit(1);
}

const adminUrl = new URL(databaseUrl);
adminUrl.pathname = "/postgres";

const prismaCommand =
  process.platform === "win32"
    ? path.join(process.cwd(), "node_modules", ".bin", "prisma.cmd")
    : path.join(process.cwd(), "node_modules", ".bin", "prisma");

function runPrisma(args, stdin) {
  if (process.platform === "win32") {
    const command = [`"${prismaCommand}"`, ...args.map((arg) => `"${arg}"`)].join(" ");

    return spawnSync(command, {
      cwd: process.cwd(),
      env: process.env,
      input: stdin,
      encoding: "utf-8",
      shell: true,
    });
  }

  return spawnSync(prismaCommand, args, {
    cwd: process.cwd(),
    env: process.env,
    input: stdin,
    encoding: "utf-8",
  });
}

function exitWith(result) {
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  process.exit(result.status ?? 1);
}

const checkResult = runPrisma(
  ["db", "execute", "--stdin", "--url", targetUrl.toString()],
  "SELECT 1;",
);

if (checkResult.status === 0) {
  console.log(`Database "${databaseName}" is ready.`);
  process.exit(0);
}

const combinedOutput = `${checkResult.stdout}\n${checkResult.stderr}`;

if (!combinedOutput.includes("P1003")) {
  exitWith(checkResult);
}

console.log(`Database "${databaseName}" not found. Creating...`);

const escapedName = databaseName.replaceAll('"', '""');
const createResult = runPrisma(
  ["db", "execute", "--stdin", "--url", adminUrl.toString()],
  `CREATE DATABASE "${escapedName}";`,
);

if (createResult.status !== 0) {
  exitWith(createResult);
}

console.log(`Database "${databaseName}" created successfully.`);
