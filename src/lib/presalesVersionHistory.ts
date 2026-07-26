import type {
  ActivityRecord,
  DashboardData,
  NaCustomer,
  PerformanceRecord,
  PPLRecord,
  SummaryRecord,
} from '../domain';
import { normalizeBusinessKey } from './normalize';
import { readLatestPresalesData } from './presalesHistory';

const DB_NAME = 'sales-dashboard-presales-history';
const DB_VERSION = 1;
const STORE_NAME = 'versions';

export type PresalesVersionKind = 'baseline' | 'delta';

export interface PresalesVersionChanges {
  added: number;
  updated: number;
  removed: number;
}

export interface PresalesVersionSummary {
  id: string;
  order: number;
  kind: PresalesVersionKind;
  fileName: string;
  importedAt: string;
  fingerprint: string;
  changes: PresalesVersionChanges;
}

interface CollectionDelta<T> {
  upserts: Array<{ key: string; value: T }>;
  addedKeys: string[];
  removedKeys: string[];
}

export interface DashboardDataDelta {
  ppl: CollectionDelta<PPLRecord>;
  summary: CollectionDelta<SummaryRecord>;
  activity: CollectionDelta<ActivityRecord>;
  performance: CollectionDelta<PerformanceRecord>;
  naCustomers: CollectionDelta<NaCustomer>;
  report: DashboardData['report'];
}

interface PresalesVersionRecord extends PresalesVersionSummary {
  baseline?: DashboardData;
  delta?: DashboardDataDelta;
}

export interface PresalesHistoryState {
  current: DashboardData | null;
  previous: DashboardData | null;
  versions: PresalesVersionSummary[];
  duplicate?: boolean;
}

export async function loadPresalesHistory(): Promise<PresalesHistoryState> {
  let records = await readVersionRecords();
  if (records.length === 0) {
    const legacy = readLatestPresalesData();
    if (legacy) {
      await savePresalesVersion(legacy);
      records = await readVersionRecords();
    }
  }
  return historyState(records);
}

export async function savePresalesVersion(data: DashboardData): Promise<PresalesHistoryState> {
  const records = await readVersionRecords();
  const fingerprint = dashboardFingerprint(data);
  const latest = records.at(-1);
  if (latest?.fingerprint === fingerprint) {
    return { ...historyState(records), duplicate: true };
  }

  const previous = reconstructVersion(records);
  const delta = previous ? buildDashboardDelta(previous, data) : undefined;
  const changes = delta
    ? summarizeDelta(delta)
    : {
        added:
          data.ppl.length +
          data.summary.length +
          data.activity.length +
          data.performance.length +
          (data.naCustomers?.length ?? 0),
        updated: 0,
        removed: 0,
      };
  const record: PresalesVersionRecord = {
    id: globalThis.crypto?.randomUUID?.() ?? `presales-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    order: records.length + 1,
    kind: previous ? 'delta' : 'baseline',
    fileName: data.report.fileName,
    importedAt: data.report.importedAt || new Date().toISOString(),
    fingerprint,
    changes,
    baseline: previous ? undefined : data,
    delta,
  };
  await putVersionRecord(record);
  return historyState([...records, record]);
}

export function buildDashboardDelta(previous: DashboardData, current: DashboardData): DashboardDataDelta {
  return {
    ppl: buildCollectionDelta(previous.ppl, current.ppl, pplKey, samePplRecord),
    summary: buildCollectionDelta(previous.summary, current.summary, summaryKey),
    activity: buildCollectionDelta(previous.activity, current.activity, activityKey),
    performance: buildCollectionDelta(previous.performance, current.performance, performanceKey),
    naCustomers: buildCollectionDelta(previous.naCustomers ?? [], current.naCustomers ?? [], naCustomerKey),
    report: current.report,
  };
}

export function applyDashboardDelta(previous: DashboardData, delta: DashboardDataDelta): DashboardData {
  return {
    ppl: applyCollectionDelta(previous.ppl, delta.ppl, pplKey),
    summary: applyCollectionDelta(previous.summary, delta.summary, summaryKey),
    activity: applyCollectionDelta(previous.activity, delta.activity, activityKey),
    performance: applyCollectionDelta(previous.performance, delta.performance, performanceKey),
    naCustomers: applyCollectionDelta(previous.naCustomers ?? [], delta.naCustomers, naCustomerKey),
    report: delta.report,
  };
}

function historyState(records: PresalesVersionRecord[]): PresalesHistoryState {
  const current = reconstructVersion(records);
  const previous = reconstructVersion(records.slice(0, -1));
  return {
    current,
    previous,
    versions: records.map(({ baseline: _baseline, delta: _delta, ...summary }) => summary),
  };
}

function reconstructVersion(records: PresalesVersionRecord[]): DashboardData | null {
  if (records.length === 0) return null;
  let data: DashboardData | null = null;
  records.forEach((record) => {
    if (record.kind === 'baseline' && record.baseline) {
      data = record.baseline;
    } else if (data && record.delta) {
      data = applyDashboardDelta(data, record.delta);
    }
  });
  return data;
}

function buildCollectionDelta<T>(
  previous: T[],
  current: T[],
  keyOf: (item: T) => string,
  equals: (left: T, right: T) => boolean = (left, right) => JSON.stringify(left) === JSON.stringify(right),
): CollectionDelta<T> {
  const previousByKey = indexRows(previous, keyOf);
  const currentByKey = indexRows(current, keyOf);
  const upserts: Array<{ key: string; value: T }> = [];
  currentByKey.forEach((value, key) => {
    const oldValue = previousByKey.get(key);
    if (!oldValue || !equals(oldValue, value)) upserts.push({ key, value });
  });
  return {
    upserts,
    addedKeys: [...currentByKey.keys()].filter((key) => !previousByKey.has(key)),
    removedKeys: [...previousByKey.keys()].filter((key) => !currentByKey.has(key)),
  };
}

function applyCollectionDelta<T>(previous: T[], delta: CollectionDelta<T>, keyOf: (item: T) => string): T[] {
  const rows = indexRows(previous, keyOf);
  delta.removedKeys.forEach((key) => rows.delete(key));
  delta.upserts.forEach(({ key, value }) => rows.set(key, value));
  return [...rows.values()];
}

function indexRows<T>(rows: T[], keyOf: (item: T) => string) {
  const result = new Map<string, T>();
  const occurrences = new Map<string, number>();
  rows.forEach((row) => {
    const baseKey = keyOf(row);
    const occurrence = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrence + 1);
    result.set(`${baseKey}#${occurrence}`, row);
  });
  return result;
}

function summarizeDelta(delta: DashboardDataDelta): PresalesVersionChanges {
  const collections = [delta.ppl, delta.summary, delta.activity, delta.performance, delta.naCustomers];
  return collections.reduce(
    (result, collection) => ({
      added: result.added + collection.addedKeys.length,
      updated: result.updated + collection.upserts.length - collection.addedKeys.length,
      removed: result.removed + collection.removedKeys.length,
    }),
    { added: 0, updated: 0, removed: 0 },
  );
}

function dashboardFingerprint(data: DashboardData) {
  const comparable = {
    ppl: indexRows(data.ppl, pplKey),
    summary: indexRows(data.summary, summaryKey),
    activity: indexRows(data.activity, activityKey),
    performance: indexRows(data.performance, performanceKey),
    naCustomers: indexRows(data.naCustomers ?? [], naCustomerKey),
  };
  return hashString(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(comparable).map(([key, value]) => [
          key,
          [...value.entries()].sort(([left], [right]) => left.localeCompare(right)),
        ]),
      ),
    ),
  );
}

function pplKey(row: PPLRecord) {
  return `${normalizeBusinessKey(row.customerName)}|${normalizeBusinessKey(row.opportunityName)}`;
}

function samePplRecord(left: PPLRecord, right: PPLRecord) {
  const { id: _leftId, ...leftValue } = left;
  const { id: _rightId, ...rightValue } = right;
  return JSON.stringify(leftValue) === JSON.stringify(rightValue);
}

function summaryKey(row: SummaryRecord) {
  return `${normalizeBusinessKey(row.team)}|${normalizeBusinessKey(row.owner)}`;
}

function activityKey(row: ActivityRecord) {
  return normalizeBusinessKey(row.owner);
}

function performanceKey(row: PerformanceRecord) {
  return [row.customerName, row.productName, row.productLevel2, row.productLevel3]
    .map(normalizeBusinessKey)
    .join('|');
}

function naCustomerKey(row: NaCustomer) {
  return `${normalizeBusinessKey(row.customer)}|${normalizeBusinessKey(row.sourceSheet)}`;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function readVersionRecords(): Promise<PresalesVersionRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const done = transactionDone(transaction);
  const records = await requestResult<PresalesVersionRecord[]>(transaction.objectStore(STORE_NAME).getAll());
  await done;
  return records.sort((a, b) => a.order - b.order);
}

async function putVersionRecord(record: PresalesVersionRecord) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore(STORE_NAME).put(record);
  await done;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('当前浏览器不支持本地数据库，无法保存售前历史版本。'));
      return;
    }
    const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('无法打开售前历史数据库。'));
    request.onblocked = () => reject(new Error('售前历史数据库正在被其他页面占用。'));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('读取售前历史数据失败。'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('保存售前历史数据失败。'));
    transaction.onabort = () => reject(transaction.error ?? new Error('保存售前历史数据已中止。'));
  });
}
