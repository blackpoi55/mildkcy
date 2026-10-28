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
  updateMany<T extends TableName>(table: T, patches: { id: string; patch: Partial<RowOf<T>> }[]): Promise<void>;
  remove(table: TableName, ids: string[]): Promise<void>;
  /** เวลาที่ดึงข้อมูลจากต้นทางล่าสุด และข้อมูลเก่าเกิน 1 นาทีหรือไม่ (เช่น โควตา Google เต็ม) */
  syncInfo(): { at: number; stale: boolean };
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
// Google จำกัดการอ่าน ~60 ครั้ง/นาที (รวมทุกเครื่องที่ใช้ service account เดียวกัน) จึง:
//  - อ่านทุกแท็บพร้อมกันในคำขอเดียว (values:batchGet)
//  - คำขอที่มาพร้อมกันใช้ผลอ่านชุดเดียวกัน
//  - เก็บแคช 20 วินาที, ถ้าโดนจำกัดโควตาให้ใช้ข้อมูลล่าสุดที่มีแทน (สูงสุด 10 นาที)

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const CACHE_MS = 20_000;
const STALE_MS = 10 * 60_000;

type Entry = { rows: AnyRow[]; rowNums: Map<string, number> };
type Snapshot = { at: number; gen: number; tables: Map<TableName, Entry> };
type ValueRange = { range: string; values?: unknown[][] };

const TABLE_NAMES = Object.keys(TABLES) as TableName[];

function colLetter(n: number) {
  let s = "";
  for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function statusOf(e: unknown) {
  const err = e as { status?: number; code?: number | string; response?: { status?: number } };
  return err?.response?.status ?? err?.status ?? (typeof err?.code === "number" ? err.code : undefined);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class SheetsStore implements Store {
  kind = "sheets" as const;
  private client: JWT;
  private sheetIds: Map<string, number> | null = null;
  private headers = new Map<TableName, string[]>();
  private snap: Snapshot | null = null;
  private inflight: Promise<Snapshot> | null = null;
  /** เพิ่มทุกครั้งที่เขียน — ผลอ่านที่เริ่มก่อนการเขียนจะไม่ถูกใช้ต่อ */
  private gen = 0;

  constructor(
    private spreadsheetId: string,
    email: string,
    key: string,
  ) {
    this.client = new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  }

  /** เรียก API — ถ้าโดนจำกัดโควตา (429) รอแล้วลองใหม่ 2 ครั้ง */
  private async req<R = unknown>(url: string, method = "GET", data?: unknown): Promise<R> {
    for (let attempt = 0; ; attempt++) {
      try {
        if (process.env.NODE_ENV === "development") console.log(`[sheets] ${method} ${decodeURIComponent(url).slice(0, 70)}`);
        const res = await this.client.request<R>({ url: `${API}/${this.spreadsheetId}${url}`, method, data });
        return res.data;
      } catch (e) {
        if (statusOf(e) !== 429 || attempt >= 2) throw e;
        await sleep(1500 * (attempt + 1));
      }
    }
  }

  private a1(table: TableName, a1: string) {
    return `'${TABLES[table].sheet}'!${a1}`;
  }

  private async loadSheetIds() {
    if (!this.sheetIds) {
      const meta = await this.req<{ sheets: { properties: { title: string; sheetId: number } }[] }>(
        "?fields=sheets.properties(title,sheetId)",
      );
      this.sheetIds = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
    }
    return this.sheetIds;
  }

  /** สร้างแท็บที่ยังไม่มี (ครั้งแรกที่ใช้งานกับชีตเปล่า) */
  private async createMissingSheets() {
    const ids = await this.loadSheetIds();
    const missing = TABLE_NAMES.filter((t) => !ids.has(TABLES[t].sheet));
    if (!missing.length) return;
    const r = await this.req<{ replies: { addSheet: { properties: { sheetId: number; title: string } } }[] }>(
      ":batchUpdate",
      "POST",
      {
        requests: missing.map((t) => ({
          addSheet: { properties: { title: TABLES[t].sheet, gridProperties: { frozenRowCount: 1 } } },
        })),
      },
    );
    for (const rep of r.replies) ids.set(rep.addSheet.properties.title, rep.addSheet.properties.sheetId);
  }

  private async fetchSnapshot(gen: number): Promise<Snapshot> {
    const qs = TABLE_NAMES.map((t) => `ranges=${encodeURIComponent(this.a1(t, "A1:Z"))}`).join("&");
    const url = `/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE`;
    let res: { valueRanges: ValueRange[] };
    try {
      res = await this.req(url);
    } catch (e) {
      if (statusOf(e) !== 400) throw e; // 400 = มีแท็บที่ยังไม่ได้สร้าง
      await this.createMissingSheets();
      res = await this.req(url);
    }

    const tables = new Map<TableName, Entry>();
    for (const [i, table] of TABLE_NAMES.entries()) {
      const values = res.valueRanges[i]?.values ?? [];
      let labels = (values[0] ?? []).map(String);
      // เพิ่มหัวคอลัมน์ที่ยังไม่มี (เช่น ฟีเจอร์ใหม่) ต่อท้ายให้อัตโนมัติ
      const missing = TABLES[table].columns.filter((c) => !labels.includes(c.label)).map((c) => c.label);
      if (missing.length) {
        labels = [...labels, ...missing];
        await this.req(`/values/${encodeURIComponent(this.a1(table, "A1"))}?valueInputOption=RAW`, "PUT", {
          values: [labels],
        });
      }
      this.headers.set(table, labels);

      const cols = TABLES[table].columns;
      const idx = cols.map((c) => labels.indexOf(c.label));
      const rows: AnyRow[] = [];
      const rowNums = new Map<string, number>();
      values.slice(1).forEach((vals, j) => {
        const raw: Record<string, unknown> = {};
        cols.forEach((c, k) => (raw[c.key] = vals[idx[k]]));
        if (!raw.id) return;
        rows.push(normalize(table, raw) as AnyRow);
        rowNums.set(String(raw.id), j + 2);
      });
      tables.set(table, { rows, rowNums });
    }
    return { at: Date.now(), gen, tables };
  }

  /** ข้อมูลทุกแท็บ (fresh = ต้องการล่าสุดจริง ๆ ก่อนแก้ไข/ลบ) */
  private async snapshot(fresh = false): Promise<Snapshot> {
    const s = this.snap;
    if (!fresh && s && s.gen === this.gen && Date.now() - s.at < CACHE_MS) return s;
    if (this.inflight) {
      const p = await this.inflight;
      if (p.gen === this.gen && (!fresh || Date.now() - p.at < 2_000)) return p;
    }
    const gen = this.gen;
    const p = this.fetchSnapshot(gen)
      .then((snap) => {
        if (snap.gen === this.gen) this.snap = snap;
        return snap;
      })
      .catch((e) => {
        // อ่านไม่ได้ (โควตาเต็ม / เน็ตหลุด) → ใช้ข้อมูลล่าสุดที่มี ถ้ายังไม่เก่าเกินไป และไม่ใช่การเตรียมแก้ไข
        if (!fresh && this.snap && Date.now() - this.snap.at < STALE_MS) {
          console.warn("[sheets] ใช้ข้อมูลในแคชแทน:", e instanceof Error ? e.message : e);
          return this.snap;
        }
        if (statusOf(e) === 429) {
          throw new Error("Google Sheets ถูกเรียกใช้ถี่เกินไป กรุณารอประมาณ 1 นาทีแล้วลองใหม่");
        }
        throw e;
      })
      .finally(() => {
        if (this.inflight === p) this.inflight = null;
      });
    this.inflight = p;
    return p;
  }

  private invalidate() {
    this.gen++;
    this.snap = null;
  }

  syncInfo() {
    const at = this.snap?.at ?? Date.now();
    return { at, stale: Date.now() - at > 60_000 };
  }

  private async labels(table: TableName) {
    if (!this.headers.has(table)) await this.snapshot();
    return this.headers.get(table)!;
  }

  private toValues(labels: string[], table: TableName, row: Record<string, unknown>) {
    const cols = TABLES[table].columns;
    return labels.map((l) => {
      const c = cols.find((x) => x.label === l);
      const v = c ? row[c.key] : "";
      return v ?? "";
    });
  }

  async all<T extends TableName>(table: T) {
    return (await this.snapshot()).tables.get(table)!.rows as RowOf<T>[];
  }

  async insert<T extends TableName>(table: T, rows: RowOf<T>[]) {
    if (!rows.length) return;
    const labels = await this.labels(table);
    await this.req(
      `/values/${encodeURIComponent(this.a1(table, "A1"))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      "POST",
      { values: rows.map((r) => this.toValues(labels, table, r as Record<string, unknown>)) },
    );
    this.invalidate();
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>) {
    await this.updateMany(table, [{ id, patch }]);
  }

  /** แก้หลายแถวในคำขอเดียว */
  async updateMany<T extends TableName>(table: T, patches: { id: string; patch: Partial<RowOf<T>> }[]) {
    if (!patches.length) return;
    const { rows, rowNums } = (await this.snapshot(true)).tables.get(table)!;
    const labels = this.headers.get(table)!;
    const last = colLetter(labels.length - 1);
    const data = patches.map(({ id, patch }) => {
      const n = rowNums.get(id);
      const cur = rows.find((r) => r.id === id);
      if (!n || !cur) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข (อาจถูกลบไปแล้ว)");
      const next = normalize(table, { ...cur, ...patch, id });
      return { range: this.a1(table, `A${n}:${last}${n}`), values: [this.toValues(labels, table, next as Record<string, unknown>)] };
    });
    await this.req("/values:batchUpdate", "POST", { valueInputOption: "RAW", data });
    this.invalidate();
  }

  async remove(table: TableName, ids: string[]) {
    const { rowNums } = (await this.snapshot(true)).tables.get(table)!;
    const nums = ids
      .map((id) => rowNums.get(id))
      .filter((n): n is number => !!n)
      .sort((a, b) => b - a);
    if (!nums.length) return;
    const sheetId = (await this.loadSheetIds()).get(TABLES[table].sheet)!;
    await this.req(":batchUpdate", "POST", {
      requests: nums.map((n) => ({
        deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: n - 1, endIndex: n } },
      })),
    });
    this.invalidate();
  }
}

// ---------------------------------------------------------------------------
// โหมดทดลอง: เก็บเป็นไฟล์ JSON ในเครื่อง (ใช้เมื่อยังไม่ได้ตั้งค่า Google Sheets)
// ---------------------------------------------------------------------------

class LocalStore implements Store {
  kind = "local" as const;
  syncInfo() {
    return { at: Date.now(), stale: false };
  }
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

  updateMany<T extends TableName>(table: T, patches: { id: string; patch: Partial<RowOf<T>> }[]) {
    return this.mutate((db) => {
      const list = db[table] ?? [];
      for (const { id, patch } of patches) {
        const i = list.findIndex((r) => r.id === id);
        if (i < 0) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข (อาจถูกลบไปแล้ว)");
        list[i] = { ...list[i], ...patch, id } as AnyRow;
      }
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
