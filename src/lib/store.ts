import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { JWT } from "google-auth-library";
import { TABLES, type Column, type RowOf, type TableName } from "./schema";

type AnyRow = Record<string, unknown> & { id: string };

export interface Store {
  kind: "sheets" | "local";
  all<T extends TableName>(table: T): Promise<RowOf<T>[]>;
  insert<T extends TableName>(table: T, rows: RowOf<T>[]): Promise<void>;
  update<T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>): Promise<void>;
  remove(table: TableName, ids: string[]): Promise<void>;
}

export function newId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

function coerce(col: Column, v: unknown): unknown {
  if (col.type === "number") {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  // ถ้าแก้วันที่ในชีตเอง Google Sheets อาจเก็บเป็นเลขลำดับวัน (serial) → แปลงกลับเป็น YYYY-MM-DD
  if (col.type === "date" && typeof v === "number") {
    return new Date(Date.UTC(1899, 11, 30) + v * 86_400_000).toISOString().slice(0, 10);
  }
  if (col.type === "boolean") return v === true || v === "TRUE" || v === "true" || v === 1 || v === "1";
  return v == null ? "" : String(v);
}

function normalize<T extends TableName>(table: T, raw: Record<string, unknown>): RowOf<T> {
  const out: Record<string, unknown> = {};
  for (const col of TABLES[table].columns) out[col.key] = coerce(col, raw[col.key]);
  return out as RowOf<T>;
}

// ---------------------------------------------------------------------------
// Google Sheets
// ---------------------------------------------------------------------------

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const CACHE_MS = 15_000;

function colLetter(n: number) {
  let s = "";
  for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

class SheetsStore implements Store {
  kind = "sheets" as const;
  private client: JWT;
  private sheetIds: Map<string, number> | null = null;
  private headers = new Map<TableName, string[]>();
  private cache = new Map<TableName, { at: number; rows: AnyRow[]; rowNums: Map<string, number> }>();

  constructor(
    private spreadsheetId: string,
    email: string,
    key: string,
  ) {
    this.client = new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  }

  private async req<R = unknown>(url: string, method = "GET", data?: unknown): Promise<R> {
    const res = await this.client.request<R>({ url: `${API}/${this.spreadsheetId}${url}`, method, data });
    return res.data;
  }

  private range(table: TableName, a1: string) {
    return encodeURIComponent(`'${TABLES[table].sheet}'!${a1}`);
  }

  /** สร้างแท็บ + หัวคอลัมน์ให้อัตโนมัติถ้ายังไม่มี */
  private async ensure(table: TableName) {
    if (this.headers.has(table)) return;
    const def = TABLES[table];
    if (!this.sheetIds) {
      const meta = await this.req<{ sheets: { properties: { title: string; sheetId: number } }[] }>(
        "?fields=sheets.properties(title,sheetId)",
      );
      this.sheetIds = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
    }
    if (!this.sheetIds.has(def.sheet)) {
      const r = await this.req<{ replies: { addSheet: { properties: { sheetId: number } } }[] }>(
        ":batchUpdate",
        "POST",
        {
          requests: [
            {
              addSheet: {
                properties: { title: def.sheet, gridProperties: { frozenRowCount: 1 } },
              },
            },
          ],
        },
      );
      this.sheetIds.set(def.sheet, r.replies[0].addSheet.properties.sheetId);
    }
    const head = await this.req<{ values?: unknown[][] }>(`/values/${this.range(table, "1:1")}`);
    let labels = (head.values?.[0] ?? []).map(String);
    const missing = def.columns.filter((c) => !labels.includes(c.label)).map((c) => c.label);
    if (missing.length) {
      labels = [...labels, ...missing];
      await this.req(`/values/${this.range(table, "A1")}?valueInputOption=RAW`, "PUT", { values: [labels] });
    }
    this.headers.set(table, labels);
  }

  private async load(table: TableName, fresh = false) {
    const hit = this.cache.get(table);
    if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit;
    await this.ensure(table);
    const labels = this.headers.get(table)!;
    const res = await this.req<{ values?: unknown[][] }>(
      `/values/${this.range(table, `A2:${colLetter(labels.length - 1)}`)}?valueRenderOption=UNFORMATTED_VALUE`,
    );
    const cols = TABLES[table].columns;
    const idx = cols.map((c) => labels.indexOf(c.label));
    const rows: AnyRow[] = [];
    const rowNums = new Map<string, number>();
    (res.values ?? []).forEach((vals, i) => {
      const raw: Record<string, unknown> = {};
      cols.forEach((c, j) => (raw[c.key] = vals[idx[j]]));
      if (!raw.id) return;
      rows.push(normalize(table, raw) as AnyRow);
      rowNums.set(String(raw.id), i + 2);
    });
    const entry = { at: Date.now(), rows, rowNums };
    this.cache.set(table, entry);
    return entry;
  }

  private toValues(table: TableName, row: Record<string, unknown>) {
    const labels = this.headers.get(table)!;
    const cols = TABLES[table].columns;
    return labels.map((l) => {
      const c = cols.find((x) => x.label === l);
      const v = c ? row[c.key] : "";
      return v ?? "";
    });
  }

  async all<T extends TableName>(table: T) {
    return (await this.load(table)).rows as RowOf<T>[];
  }

  async insert<T extends TableName>(table: T, rows: RowOf<T>[]) {
    if (!rows.length) return;
    await this.ensure(table);
    await this.req(
      `/values/${this.range(table, "A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      "POST",
      { values: rows.map((r) => this.toValues(table, r as Record<string, unknown>)) },
    );
    this.cache.delete(table);
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>) {
    const { rows, rowNums } = await this.load(table, true);
    const n = rowNums.get(id);
    const cur = rows.find((r) => r.id === id);
    if (!n || !cur) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข (อาจถูกลบไปแล้ว)");
    const next = normalize(table, { ...cur, ...patch, id });
    const labels = this.headers.get(table)!;
    await this.req(
      `/values/${this.range(table, `A${n}:${colLetter(labels.length - 1)}${n}`)}?valueInputOption=RAW`,
      "PUT",
      { values: [this.toValues(table, next as Record<string, unknown>)] },
    );
    this.cache.delete(table);
  }

  async remove(table: TableName, ids: string[]) {
    const { rowNums } = await this.load(table, true);
    const nums = ids
      .map((id) => rowNums.get(id))
      .filter((n): n is number => !!n)
      .sort((a, b) => b - a);
    if (!nums.length) return;
    const sheetId = this.sheetIds!.get(TABLES[table].sheet)!;
    await this.req(":batchUpdate", "POST", {
      requests: nums.map((n) => ({
        deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: n - 1, endIndex: n } },
      })),
    });
    this.cache.delete(table);
  }
}

// ---------------------------------------------------------------------------
// โหมดทดลอง: เก็บเป็นไฟล์ JSON ในเครื่อง (ใช้เมื่อยังไม่ได้ตั้งค่า Google Sheets)
// ---------------------------------------------------------------------------

class LocalStore implements Store {
  kind = "local" as const;
  private file = path.join(process.cwd(), ".data", "db.json");
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<Record<string, AnyRow[]>> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch {
      return {};
    }
  }

  private async write(db: Record<string, AnyRow[]>) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(db));
  }

  /** เขียนทีละคำสั่ง กันไฟล์ทับกัน */
  private mutate(fn: (db: Record<string, AnyRow[]>) => void) {
    const run = this.queue.then(async () => {
      const db = await this.read();
      fn(db);
      await this.write(db);
    });
    this.queue = run.catch(() => {});
    return run;
  }

  async all<T extends TableName>(table: T) {
    await this.queue;
    const db = await this.read();
    return (db[table] ?? []).map((r) => normalize(table, r));
  }

  insert<T extends TableName>(table: T, rows: RowOf<T>[]) {
    return this.mutate((db) => {
      db[table] = [...(db[table] ?? []), ...(rows as AnyRow[])];
    });
  }

  update<T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>) {
    return this.mutate((db) => {
      const list = db[table] ?? [];
      const i = list.findIndex((r) => r.id === id);
      if (i < 0) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข (อาจถูกลบไปแล้ว)");
      list[i] = { ...list[i], ...patch, id } as AnyRow;
    });
  }

  remove(table: TableName, ids: string[]) {
    return this.mutate((db) => {
      db[table] = (db[table] ?? []).filter((r) => !ids.includes(r.id));
    });
  }
}

// ---------------------------------------------------------------------------

const g = globalThis as unknown as { __store?: Store };

export function sheetsConfigured() {
  return !!(
    process.env.GOOGLE_SHEET_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );
}

export function getStore(): Store {
  if (!g.__store) {
    g.__store = sheetsConfigured()
      ? new SheetsStore(
          process.env.GOOGLE_SHEET_ID!,
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
          process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
        )
      : new LocalStore();
  }
  return g.__store;
}
