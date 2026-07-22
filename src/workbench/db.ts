import type { DashboardData, PPLRecord } from '../domain';
import type {
  CustomerMapping,
  ImportBatch,
  ImportCaptureInput,
  ImportCaptureResult,
  OpportunityMapping,
  OpportunitySnapshot,
  Person,
  SaveEventInput,
  TestProject,
  WorkEvent,
  WorkEventRevision,
  WorkParticipant,
  WorkType,
  WorkbenchBackup,
  WorkbenchData,
} from './domain';

const DB_NAME = 'sales-dashboard-workbench';
const DB_VERSION = 2;

const STORES = {
  meta: 'meta',
  people: 'people',
  workTypes: 'workTypes',
  events: 'events',
  eventRevisions: 'eventRevisions',
  participants: 'participants',
  testProjects: 'testProjects',
  customers: 'customers',
  opportunities: 'opportunities',
  snapshots: 'snapshots',
  importBatches: 'importBatches',
} as const;

const DEFAULT_WORK_TYPES: Array<Pick<WorkType, 'id' | 'code' | 'name' | 'color' | 'sortOrder'>> = [
  {
    id: 'type_customer_communication',
    code: 'customer_communication',
    name: '客户交流',
    color: '#2563eb',
    sortOrder: 10,
  },
  { id: 'type_customer_visit', code: 'customer_visit', name: '客户拜访', color: '#0ea5e9', sortOrder: 20 },
  {
    id: 'type_solution_writing',
    code: 'solution_writing',
    name: '方案编写',
    color: '#8b5cf6',
    sortOrder: 30,
  },
  { id: 'type_product_demo', code: 'product_demo', name: '产品演示', color: '#06b6d4', sortOrder: 40 },
  { id: 'type_test_poc', code: 'test_poc', name: '测试/POC', color: '#f59e0b', sortOrder: 50 },
  { id: 'type_bid_support', code: 'bid_support', name: '投标支持', color: '#ef4444', sortOrder: 60 },
  {
    id: 'type_internal_collaboration',
    code: 'internal_collaboration',
    name: '内部协同',
    color: '#10b981',
    sortOrder: 70,
  },
  { id: 'type_other', code: 'other', name: '其他', color: '#64748b', sortOrder: 80 },
];

let databasePromise: Promise<IDBDatabase> | null = null;

export async function initializeWorkbench() {
  const database = await openDatabase();
  const transaction = database.transaction([STORES.meta, STORES.workTypes], 'readwrite');
  const metaStore = transaction.objectStore(STORES.meta);
  const request = metaStore.get('seeded-v1');
  request.onsuccess = () => {
    if (request.result) return;
    const now = new Date().toISOString();
    const typeStore = transaction.objectStore(STORES.workTypes);
    DEFAULT_WORK_TYPES.forEach((item) => {
      typeStore.put({
        ...item,
        status: 'active',
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      } satisfies WorkType);
    });
    metaStore.put({ key: 'seeded-v1', value: true, updatedAt: now });
  };
  await transactionDone(transaction);
  await ensureEventRevisionBaselines(database);
}

export async function loadWorkbenchData(): Promise<WorkbenchData> {
  const database = await openDatabase();
  const names = [
    STORES.people,
    STORES.workTypes,
    STORES.events,
    STORES.eventRevisions,
    STORES.participants,
    STORES.testProjects,
    STORES.customers,
    STORES.opportunities,
    STORES.snapshots,
    STORES.importBatches,
  ];
  const transaction = database.transaction(names, 'readonly');
  const done = transactionDone(transaction);
  const requests = names.map((name) => requestResult<unknown[]>(transaction.objectStore(name).getAll()));
  const [
    people,
    workTypes,
    events,
    eventRevisions,
    participants,
    testProjects,
    customers,
    opportunities,
    snapshots,
    importBatches,
  ] = await Promise.all(requests);
  await done;
  return {
    people: (people as Person[]).sort(bySortOrderThenName),
    workTypes: (workTypes as WorkType[]).sort(bySortOrderThenName),
    events: (events as WorkEvent[]).sort((a, b) => a.startAt.localeCompare(b.startAt)),
    eventRevisions: (eventRevisions as WorkEventRevision[]).sort((a, b) =>
      b.savedAt.localeCompare(a.savedAt),
    ),
    participants: participants as WorkParticipant[],
    testProjects: (testProjects as TestProject[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    customers: (customers as CustomerMapping[]).sort((a, b) =>
      a.canonicalName.localeCompare(b.canonicalName, 'zh-CN'),
    ),
    opportunities: (opportunities as OpportunityMapping[]).sort((a, b) =>
      a.canonicalName.localeCompare(b.canonicalName, 'zh-CN'),
    ),
    snapshots: snapshots as OpportunitySnapshot[],
    importBatches: (importBatches as ImportBatch[]).sort((a, b) => b.importedAt.localeCompare(a.importedAt)),
  };
}

export async function savePerson(person: Person) {
  await putRecord(STORES.people, person);
}

export async function saveWorkType(workType: WorkType) {
  await putRecord(STORES.workTypes, workType);
}

export async function saveTestProject(project: TestProject) {
  await putRecord(STORES.testProjects, project);
}

export async function createTemporaryCustomer(name: string): Promise<CustomerMapping> {
  const now = new Date().toISOString();
  const customer: CustomerMapping = {
    id: newId(),
    canonicalName: name.trim(),
    sourceKey: `manual:${newId()}`,
    aliases: [name.trim()],
    matchStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  await putRecord(STORES.customers, customer);
  return customer;
}

export async function saveWorkEvent(input: SaveEventInput) {
  const database = await openDatabase();
  const transaction = database.transaction(
    [STORES.events, STORES.eventRevisions, STORES.participants],
    'readwrite',
  );
  transaction.objectStore(STORES.events).put(input.event);
  transaction.objectStore(STORES.eventRevisions).put({
    id: newId(),
    eventId: input.event.id,
    savedAt: input.event.updatedAt,
    source: 'saved',
    event: input.event,
    participants: input.participants,
  } satisfies WorkEventRevision);
  const participantStore = transaction.objectStore(STORES.participants);
  const keyRequest = participantStore.index('eventId').getAllKeys(input.event.id);
  keyRequest.onsuccess = () => {
    keyRequest.result.forEach((key) => participantStore.delete(key));
    input.participants.forEach((participant) => participantStore.put(participant));
  };
  await transactionDone(transaction);
}

export async function deleteWorkEvent(eventId: string) {
  const database = await openDatabase();
  const transaction = database.transaction(
    [STORES.events, STORES.eventRevisions, STORES.participants],
    'readwrite',
  );
  transaction.objectStore(STORES.events).delete(eventId);

  const revisionStore = transaction.objectStore(STORES.eventRevisions);
  const revisionKeys = revisionStore.index('eventId').getAllKeys(eventId);
  revisionKeys.onsuccess = () => revisionKeys.result.forEach((key) => revisionStore.delete(key));

  const participantStore = transaction.objectStore(STORES.participants);
  const participantKeys = participantStore.index('eventId').getAllKeys(eventId);
  participantKeys.onsuccess = () => participantKeys.result.forEach((key) => participantStore.delete(key));

  await transactionDone(transaction);
}

export async function captureDashboardImport(input: ImportCaptureInput): Promise<ImportCaptureResult> {
  await initializeWorkbench();
  const current = await loadWorkbenchData();
  const now = new Date().toISOString();
  const pipelineOwners = extractPipelineOwnerNames(input.data);
  const existingPersonNames = new Set(current.people.map((person) => person.normalizedName));
  const nextPersonSortOrder = Math.max(0, ...current.people.map((person) => person.sortOrder));
  const newPeople = pipelineOwners
    .filter((name) => !existingPersonNames.has(normalizeBusinessName(name)))
    .map(
      (name, index): Person => ({
        id: newId(),
        name,
        normalizedName: normalizeBusinessName(name),
        status: 'active',
        sortOrder: nextPersonSortOrder + (index + 1) * 10,
        createdAt: now,
        updatedAt: now,
      }),
    );
  const { payload, fingerprint } = buildImportFingerprint(input.sourceModule, input.data);
  const duplicateBatch = current.importBatches.find((batch) => batch.fingerprint === fingerprint);
  if (duplicateBatch) {
    if (newPeople.length > 0) {
      const database = await openDatabase();
      const transaction = database.transaction(STORES.people, 'readwrite');
      const peopleStore = transaction.objectStore(STORES.people);
      newPeople.forEach((person) => peopleStore.put(person));
      await transactionDone(transaction);
    }
    return {
      duplicate: true,
      batch: duplicateBatch,
      identifiedPersonCount: pipelineOwners.length,
      newPersonCount: newPeople.length,
    };
  }

  const batchId = newId();
  const customersBySourceKey = new Map(current.customers.map((item) => [item.sourceKey, item]));
  const opportunitiesBySourceKey = new Map(current.opportunities.map((item) => [item.sourceKey, item]));
  const latestSnapshotByOpportunity = new Map<string, OpportunitySnapshot>();
  current.snapshots.forEach((snapshot) => {
    const latest = latestSnapshotByOpportunity.get(snapshot.opportunityId);
    if (!latest || latest.capturedAt < snapshot.capturedAt)
      latestSnapshotByOpportunity.set(snapshot.opportunityId, snapshot);
  });

  const newCustomers: CustomerMapping[] = [];
  const newOpportunities: OpportunityMapping[] = [];
  const newSnapshots: OpportunitySnapshot[] = [];
  let unchangedOpportunityCount = 0;

  payload.rows.forEach((row) => {
    const customerSourceKey = `name:${normalizeBusinessName(row.customerName)}`;
    let customer = customersBySourceKey.get(customerSourceKey);
    if (!customer) {
      customer = {
        id: newId(),
        canonicalName: row.customerName,
        sourceKey: customerSourceKey,
        aliases: [row.customerName],
        matchStatus: 'matched',
        createdAt: now,
        updatedAt: now,
      };
      customersBySourceKey.set(customerSourceKey, customer);
      newCustomers.push(customer);
    }

    const opportunitySourceKey = `${customer.id}|name:${normalizeBusinessName(row.opportunityName)}`;
    let opportunity = opportunitiesBySourceKey.get(opportunitySourceKey);
    if (!opportunity) {
      opportunity = {
        id: newId(),
        customerId: customer.id,
        canonicalName: row.opportunityName,
        sourceKey: opportunitySourceKey,
        aliases: [row.opportunityName],
        createdAt: now,
        updatedAt: now,
      };
      opportunitiesBySourceKey.set(opportunitySourceKey, opportunity);
      newOpportunities.push(opportunity);
    }

    const snapshotFingerprint = hashString(`${row.stage}|${row.amount}|${row.status}|${row.isWon}`);
    const latest = latestSnapshotByOpportunity.get(opportunity.id);
    if (latest?.fingerprint === snapshotFingerprint) {
      unchangedOpportunityCount += 1;
      return;
    }
    const snapshot: OpportunitySnapshot = {
      id: newId(),
      opportunityId: opportunity.id,
      importBatchId: batchId,
      stage: row.stage,
      amount: row.amount,
      status: row.status,
      isWon: row.isWon,
      capturedAt: now,
      fingerprint: snapshotFingerprint,
    };
    latestSnapshotByOpportunity.set(opportunity.id, snapshot);
    newSnapshots.push(snapshot);
  });

  const batch: ImportBatch = {
    id: batchId,
    sourceModule: input.sourceModule,
    fileName: input.data.report.fileName,
    importedAt: now,
    fingerprint,
    sourceRowCount: input.data.ppl.length,
    newCustomerCount: newCustomers.length,
    newOpportunityCount: newOpportunities.length,
    changedSnapshotCount: newSnapshots.length,
    unchangedOpportunityCount,
    duplicateSourceRowCount: payload.duplicateSourceRowCount,
  };

  const database = await openDatabase();
  const transaction = database.transaction(
    [STORES.people, STORES.customers, STORES.opportunities, STORES.snapshots, STORES.importBatches],
    'readwrite',
  );
  const peopleStore = transaction.objectStore(STORES.people);
  const customerStore = transaction.objectStore(STORES.customers);
  const opportunityStore = transaction.objectStore(STORES.opportunities);
  const snapshotStore = transaction.objectStore(STORES.snapshots);
  newPeople.forEach((person) => peopleStore.put(person));
  newCustomers.forEach((item) => customerStore.put(item));
  newOpportunities.forEach((item) => opportunityStore.put(item));
  newSnapshots.forEach((item) => snapshotStore.put(item));
  transaction.objectStore(STORES.importBatches).put(batch);
  await transactionDone(transaction);
  return {
    duplicate: false,
    batch,
    identifiedPersonCount: pipelineOwners.length,
    newPersonCount: newPeople.length,
  };
}

export async function exportWorkbenchBackup(): Promise<WorkbenchBackup> {
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), data: await loadWorkbenchData() };
}

export async function restoreWorkbenchBackup(backup: WorkbenchBackup) {
  if (backup.schemaVersion !== 1 || !backup.data) throw new Error('备份文件版本不受支持。');
  const database = await openDatabase();
  const storeNames = [
    STORES.people,
    STORES.workTypes,
    STORES.events,
    STORES.eventRevisions,
    STORES.participants,
    STORES.testProjects,
    STORES.customers,
    STORES.opportunities,
    STORES.snapshots,
    STORES.importBatches,
  ];
  const transaction = database.transaction(storeNames, 'readwrite');
  const recordsByStore: Record<string, unknown[]> = {
    [STORES.people]: backup.data.people,
    [STORES.workTypes]: backup.data.workTypes,
    [STORES.events]: backup.data.events,
    [STORES.eventRevisions]: backup.data.eventRevisions ?? [],
    [STORES.participants]: backup.data.participants,
    [STORES.testProjects]: backup.data.testProjects,
    [STORES.customers]: backup.data.customers,
    [STORES.opportunities]: backup.data.opportunities,
    [STORES.snapshots]: backup.data.snapshots,
    [STORES.importBatches]: backup.data.importBatches,
  };
  storeNames.forEach((storeName) => {
    const store = transaction.objectStore(storeName);
    store.clear();
    recordsByStore[storeName].forEach((record) => store.put(record));
  });
  await transactionDone(transaction);
  await ensureEventRevisionBaselines(database);
}

export function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeBusinessName(value: string) {
  return value.replace(/\s+/g, '').trim().toLowerCase();
}

export function extractPipelineOwnerNames(data: DashboardData) {
  const ignoredNames = new Set(['', '-', '—', '无', '未知', '未填写', '未分配', 'unknown']);
  const ownersByNormalizedName = new Map<string, string>();
  data.ppl.forEach((row) => {
    row.owner
      .split(/[、,，;；/|\\\r\n]+/)
      .map((name) => name.trim())
      .forEach((name) => {
        const normalizedName = normalizeBusinessName(name);
        if (ignoredNames.has(normalizedName) || ownersByNormalizedName.has(normalizedName)) return;
        ownersByNormalizedName.set(normalizedName, name);
      });
  });
  return [...ownersByNormalizedName.values()];
}

export function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildImportFingerprint(
  sourceModule: ImportCaptureInput['sourceModule'],
  data: DashboardData,
) {
  const payload = buildImportPayload(data);
  return {
    payload,
    fingerprint: hashString(`${sourceModule}|${JSON.stringify(payload.rows)}`),
  };
}

function buildImportPayload(data: DashboardData) {
  const rowsByKey = new Map<string, NonNullable<ReturnType<typeof toImportRow>>>();
  let duplicateSourceRowCount = 0;
  data.ppl.forEach((row) => {
    const normalized = toImportRow(row);
    if (!normalized) return;
    const key = `${normalizeBusinessName(normalized.customerName)}|${normalizeBusinessName(normalized.opportunityName)}`;
    if (rowsByKey.has(key)) {
      duplicateSourceRowCount += 1;
      return;
    }
    rowsByKey.set(key, normalized);
  });
  return {
    rows: [...rowsByKey.values()].sort((a, b) =>
      `${a.customerName}|${a.opportunityName}`.localeCompare(
        `${b.customerName}|${b.opportunityName}`,
        'zh-CN',
      ),
    ),
    duplicateSourceRowCount,
  };
}

function toImportRow(row: PPLRecord) {
  const customerName = row.customerName?.trim();
  const opportunityName = row.opportunityName?.trim();
  if (!customerName || customerName === '未填写' || !opportunityName || opportunityName === '未命名商机')
    return null;
  return {
    customerName,
    opportunityName,
    stage: row.stage || 'Unknown',
    amount: Number.isFinite(row.amount) ? row.amount : 0,
    status: row.status || 'Unknown',
    isWon: /赢单|已成交|成交|closed.?won/i.test(`${row.stage} ${row.status}`),
  };
}

async function ensureEventRevisionBaselines(database: IDBDatabase) {
  const storeNames = [STORES.events, STORES.eventRevisions, STORES.participants];
  const transaction = database.transaction(storeNames, 'readonly');
  const done = transactionDone(transaction);
  const [events, revisions, participants] = await Promise.all([
    requestResult<WorkEvent[]>(transaction.objectStore(STORES.events).getAll()),
    requestResult<WorkEventRevision[]>(transaction.objectStore(STORES.eventRevisions).getAll()),
    requestResult<WorkParticipant[]>(transaction.objectStore(STORES.participants).getAll()),
  ]);
  await done;

  const eventIdsWithHistory = new Set(revisions.map((revision) => revision.eventId));
  const eventsWithoutHistory = events.filter((event) => !eventIdsWithHistory.has(event.id));
  if (eventsWithoutHistory.length === 0) return;

  const writeTransaction = database.transaction(STORES.eventRevisions, 'readwrite');
  const revisionStore = writeTransaction.objectStore(STORES.eventRevisions);
  eventsWithoutHistory.forEach((event) => {
    revisionStore.put({
      id: `${event.id}:baseline`,
      eventId: event.id,
      savedAt: event.updatedAt || event.createdAt,
      source: 'baseline',
      event,
      participants: participants.filter((participant) => participant.eventId === event.id),
    } satisfies WorkEventRevision);
  });
  await transactionDone(writeTransaction);
}

async function putRecord(storeName: string, record: unknown) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(record);
  await transactionDone(transaction);
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('当前浏览器不支持本地数据库，无法保存售前工作台数据。'));
      return;
    }
    const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('无法打开售前工作台本地数据库。'));
    request.onblocked = () => reject(new Error('售前工作台数据库正在被其他页面占用，请关闭其他页面后重试。'));
    request.onupgradeneeded = () => createSchema(request.result);
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
  databasePromise = pending.catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

function createSchema(database: IDBDatabase) {
  if (!database.objectStoreNames.contains(STORES.meta))
    database.createObjectStore(STORES.meta, { keyPath: 'key' });
  if (!database.objectStoreNames.contains(STORES.people)) {
    const store = database.createObjectStore(STORES.people, { keyPath: 'id' });
    store.createIndex('normalizedName', 'normalizedName', { unique: true });
  }
  if (!database.objectStoreNames.contains(STORES.workTypes)) {
    const store = database.createObjectStore(STORES.workTypes, { keyPath: 'id' });
    store.createIndex('code', 'code', { unique: true });
  }
  if (!database.objectStoreNames.contains(STORES.events)) {
    const store = database.createObjectStore(STORES.events, { keyPath: 'id' });
    store.createIndex('startAt', 'startAt');
    store.createIndex('status', 'status');
  }
  if (!database.objectStoreNames.contains(STORES.eventRevisions)) {
    const store = database.createObjectStore(STORES.eventRevisions, { keyPath: 'id' });
    store.createIndex('eventId', 'eventId');
    store.createIndex('savedAt', 'savedAt');
  }
  if (!database.objectStoreNames.contains(STORES.participants)) {
    const store = database.createObjectStore(STORES.participants, { keyPath: 'id' });
    store.createIndex('eventId', 'eventId');
    store.createIndex('personId', 'personId');
  }
  if (!database.objectStoreNames.contains(STORES.testProjects)) {
    database.createObjectStore(STORES.testProjects, { keyPath: 'id' });
  }
  if (!database.objectStoreNames.contains(STORES.customers)) {
    const store = database.createObjectStore(STORES.customers, { keyPath: 'id' });
    store.createIndex('sourceKey', 'sourceKey', { unique: true });
  }
  if (!database.objectStoreNames.contains(STORES.opportunities)) {
    const store = database.createObjectStore(STORES.opportunities, { keyPath: 'id' });
    store.createIndex('sourceKey', 'sourceKey', { unique: true });
    store.createIndex('customerId', 'customerId');
  }
  if (!database.objectStoreNames.contains(STORES.snapshots)) {
    const store = database.createObjectStore(STORES.snapshots, { keyPath: 'id' });
    store.createIndex('opportunityId', 'opportunityId');
    store.createIndex('importBatchId', 'importBatchId');
  }
  if (!database.objectStoreNames.contains(STORES.importBatches)) {
    const store = database.createObjectStore(STORES.importBatches, { keyPath: 'id' });
    store.createIndex('fingerprint', 'fingerprint', { unique: true });
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('本地数据库读取失败。'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('本地数据库操作失败。'));
    transaction.onabort = () => reject(transaction.error ?? new Error('本地数据库操作已中止。'));
  });
}

function bySortOrderThenName(a: { sortOrder: number; name: string }, b: { sortOrder: number; name: string }) {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN');
}
