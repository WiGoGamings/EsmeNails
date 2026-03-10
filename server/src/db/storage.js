import path from "node:path";
import { copyFile, access, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { JSONFilePreset } from "lowdb/node";
import { defaultData } from "./defaultData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localDbPath = path.join(__dirname, "database.json");
const localSeedPath = path.join(__dirname, "database.seed.json");
const dbPath = String(process.env.DB_FILE_PATH || localDbPath).trim() || localDbPath;
const seedPath = String(process.env.DB_SEED_PATH || localSeedPath).trim() || localSeedPath;

const fileExists = async (targetPath) => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

// First boot: copy clean seed into runtime DB file if it does not exist.
await mkdir(path.dirname(dbPath), { recursive: true });

if (!(await fileExists(dbPath)) && (await fileExists(seedPath))) {
  await copyFile(seedPath, dbPath);
}

export const db = await JSONFilePreset(dbPath, defaultData);

if (!Array.isArray(db.data.employees)) {
  db.data.employees = defaultData.employees.map((employee) => ({ ...employee }));
  await db.write();
}

if (!Array.isArray(db.data.completedAppointments)) {
  db.data.completedAppointments = [];
  await db.write();
}

if (!Array.isArray(db.data.contactMessages)) {
  db.data.contactMessages = [];
  await db.write();
}

if (!Array.isArray(db.data.payments)) {
  db.data.payments = [];
  await db.write();
}

if (!db.data.ownerContact || typeof db.data.ownerContact !== "object") {
  db.data.ownerContact = { ...defaultData.ownerContact };
  await db.write();
}

const ownerContactWithDefaults = {
  ...defaultData.ownerContact,
  ...db.data.ownerContact
};

if (JSON.stringify(ownerContactWithDefaults) !== JSON.stringify(db.data.ownerContact)) {
  db.data.ownerContact = ownerContactWithDefaults;
  await db.write();
}

if (!db.data.pointsProgram || typeof db.data.pointsProgram !== "object") {
  db.data.pointsProgram = { ...defaultData.pointsProgram };
  await db.write();
}

const pointsProgramWithDefaults = {
  ...defaultData.pointsProgram,
  ...db.data.pointsProgram,
  rewards: Array.isArray(db.data.pointsProgram?.rewards)
    ? db.data.pointsProgram.rewards
    : defaultData.pointsProgram.rewards
};

if (JSON.stringify(pointsProgramWithDefaults) !== JSON.stringify(db.data.pointsProgram)) {
  db.data.pointsProgram = pointsProgramWithDefaults;
  await db.write();
}

if (!Array.isArray(db.data.pointsGameAchievements)) {
  db.data.pointsGameAchievements = defaultData.pointsGameAchievements.map((item) => ({ ...item }));
  await db.write();
}

const ensureImageField = async (collection) => {
  if (!Array.isArray(db.data[collection])) return;

  let changed = false;
  db.data[collection] = db.data[collection].map((entry) => {
    if (typeof entry?.imageUrl === "string") {
      return entry;
    }
    changed = true;
    return {
      ...entry,
      imageUrl: ""
    };
  });

  if (changed) {
    await db.write();
  }
};

await ensureImageField("services");
await ensureImageField("products");
await ensureImageField("promotions");
await ensureImageField("employees");

const ensureDefaultEntries = async (collection) => {
  if (!Array.isArray(db.data[collection]) || !Array.isArray(defaultData[collection])) return;

  const existingIds = new Set(db.data[collection].map((entry) => entry?.id).filter(Boolean));
  const toInsert = defaultData[collection]
    .filter((entry) => entry?.id && !existingIds.has(entry.id))
    .map((entry) => ({ ...entry }));

  if (toInsert.length > 0) {
    db.data[collection].push(...toInsert);
    await db.write();
  }
};

await ensureDefaultEntries("services");
await ensureDefaultEntries("promotions");

export const persist = async () => {
  await db.write();
};
