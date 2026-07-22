import type { DashboardData } from '../domain';

export type EntityStatus = 'active' | 'inactive';
export type WorkStatus = 'planned' | 'completed' | 'cancelled';
export type WorkbenchModule = 'sales' | 'presales' | 'workbench';
export type MatchStatus = 'matched' | 'pending';

export interface Person {
  id: string;
  name: string;
  normalizedName: string;
  status: EntityStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkType {
  id: string;
  code: string;
  name: string;
  color: string;
  status: EntityStatus;
  sortOrder: number;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkEvent {
  id: string;
  title: string;
  status: WorkStatus;
  /** 旧记录缺省时按 detailed 处理。 */
  entryMode?: 'quick' | 'detailed';
  /** 快速草稿没有虚构的具体时段。 */
  allDay?: boolean;
  startAt: string;
  endAt: string;
  workTypeId?: string;
  ownerId?: string;
  customerId?: string;
  customerNameSnapshot: string;
  opportunityId?: string;
  opportunityNameSnapshot: string;
  workMode: string;
  location: string;
  content: string;
  result: string;
  nextAction: string;
  testProjectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkParticipant {
  id: string;
  eventId: string;
  personId: string;
  actualMinutes: number;
}

export interface WorkEventRevision {
  id: string;
  eventId: string;
  savedAt: string;
  source: 'baseline' | 'saved';
  event: WorkEvent;
  participants: WorkParticipant[];
}

export interface TestProject {
  id: string;
  name: string;
  customerId?: string;
  opportunityId?: string;
  product: string;
  ownerId: string;
  participantIds: string[];
  startDate: string;
  endDate: string;
  status: 'in_progress' | 'finished' | 'cancelled';
  outcome: 'pending' | 'success' | 'partial' | 'failed';
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerMapping {
  id: string;
  canonicalName: string;
  sourceKey: string;
  aliases: string[];
  matchStatus: MatchStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityMapping {
  id: string;
  customerId: string;
  canonicalName: string;
  sourceKey: string;
  aliases: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OpportunitySnapshot {
  id: string;
  opportunityId: string;
  importBatchId: string;
  stage: string;
  amount: number;
  status: string;
  isWon: boolean;
  capturedAt: string;
  fingerprint: string;
}

export interface ImportBatch {
  id: string;
  sourceModule: WorkbenchModule;
  fileName: string;
  importedAt: string;
  fingerprint: string;
  sourceRowCount: number;
  newCustomerCount: number;
  newOpportunityCount: number;
  changedSnapshotCount: number;
  unchangedOpportunityCount: number;
  duplicateSourceRowCount: number;
}

export interface WorkbenchData {
  people: Person[];
  workTypes: WorkType[];
  events: WorkEvent[];
  eventRevisions: WorkEventRevision[];
  participants: WorkParticipant[];
  testProjects: TestProject[];
  customers: CustomerMapping[];
  opportunities: OpportunityMapping[];
  snapshots: OpportunitySnapshot[];
  importBatches: ImportBatch[];
}

export interface SaveEventInput {
  event: WorkEvent;
  participants: WorkParticipant[];
}

export interface ImportCaptureInput {
  sourceModule: WorkbenchModule;
  data: DashboardData;
}

export interface ImportCaptureResult {
  duplicate: boolean;
  batch: ImportBatch;
  identifiedPersonCount: number;
  newPersonCount: number;
}

export interface WorkbenchBackup {
  schemaVersion: 1;
  exportedAt: string;
  data: WorkbenchData;
}
