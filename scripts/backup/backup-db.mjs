import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const defaultDbPath = path.join(repoRoot, "server", "src", "db", "database.json");
const fallbackSeedPath = path.join(repoRoot, "server", "src", "db", "database.seed.json");
const sourcePath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : defaultDbPath;
const backupDir = path.join(repoRoot, "backups");

const pad = (value) => String(value).padStart(2, "0");
const makeTimestamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  return `${year}${month}${day}-${hour}${minute}${second}`;
};

const ensureSourceExists = async () => {
  try {
    await fs.access(sourcePath);
    return sourcePath;
  } catch {
    await fs.access(fallbackSeedPath);
    return fallbackSeedPath;
  }
};

const run = async () => {
  const resolvedSource = await ensureSourceExists();
  await fs.mkdir(backupDir, { recursive: true });

  const timestamp = makeTimestamp();
  const snapshotName = `database-backup-${timestamp}.json`;
  const latestName = "database-backup-latest.json";

  const snapshotPath = path.join(backupDir, snapshotName);
  const latestPath = path.join(backupDir, latestName);

  await fs.copyFile(resolvedSource, snapshotPath);
  await fs.copyFile(resolvedSource, latestPath);

  console.log("Backup creado correctamente.");
  console.log(`Origen: ${resolvedSource}`);
  console.log(`Snapshot: ${snapshotPath}`);
  console.log(`Latest: ${latestPath}`);
};

run().catch((error) => {
  console.error("No se pudo crear el backup:", error.message || error);
  process.exitCode = 1;
});
