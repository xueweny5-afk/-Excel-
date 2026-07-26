import { matchesCustomerSearch } from './customerSearch';
import { normalizeBusinessName } from './db';
import type {
  CustomerMapping,
  OpportunityMapping,
  Person,
  WorkEvent,
  WorkParticipant,
  WorkType,
} from './domain';

export type CustomerWorkloadCategory = 'opportunity' | 'other' | 'unlinked';
export type CustomerMatchReason =
  | 'opportunity'
  | 'customer'
  | 'fuzzy'
  | 'unmatched'
  | 'ambiguous'
  | 'missing';

export interface CustomerMatchResult {
  category: CustomerWorkloadCategory;
  key: string;
  customerId?: string;
  name: string;
  reason: CustomerMatchReason;
  candidateCustomerIds: string[];
}

export interface CustomerWorkloadItem {
  key: string;
  category: CustomerWorkloadCategory;
  customerId?: string;
  name: string;
  eventCount: number;
  minutes: number;
  eventIds: string[];
}

export interface WorkloadStats {
  teamEventCount: number;
  personalEventCount: number;
  totalMinutes: number;
  customerCount: number;
  otherCustomerCount: number;
  unlinkedEventCount: number;
  visitCount: number;
  people: Array<{ id: string; name: string; eventCount: number; minutes: number }>;
  types: Array<{ id: string; name: string; color: string; eventCount: number; minutes: number }>;
  customers: CustomerWorkloadItem[];
  customerMatches: Record<string, CustomerMatchResult>;
}

export interface WorkloadFilter {
  from?: string;
  to?: string;
  personId?: string;
  workTypeId?: string;
  customerQuery?: string;
}

export function buildWorkloadStats(
  events: WorkEvent[],
  participants: WorkParticipant[],
  people: Person[],
  workTypes: WorkType[],
  customersOrFilter: CustomerMapping[] | WorkloadFilter = {},
  opportunitiesOrFilter: OpportunityMapping[] | WorkloadFilter = [],
  maybeFilter: WorkloadFilter = {},
): WorkloadStats {
  const customers = Array.isArray(customersOrFilter) ? customersOrFilter : [];
  const opportunities =
    Array.isArray(customersOrFilter) && Array.isArray(opportunitiesOrFilter) ? opportunitiesOrFilter : [];
  const filter = Array.isArray(customersOrFilter)
    ? Array.isArray(opportunitiesOrFilter)
      ? maybeFilter
      : opportunitiesOrFilter
    : customersOrFilter;
  const customersById = new Map(customers.map((item) => [item.id, item]));

  const eligibleEvents = events.filter((event) => {
    if (event.status !== 'completed') return false;
    if (filter.from && event.startAt.slice(0, 10) < filter.from) return false;
    if (filter.to && event.startAt.slice(0, 10) > filter.to) return false;
    if (filter.workTypeId && event.workTypeId !== filter.workTypeId) return false;
    if (
      filter.customerQuery &&
      !eventMatchesCustomerQuery(event, customers, customersById, filter.customerQuery)
    ) {
      return false;
    }
    if (
      filter.personId &&
      !participants.some((item) => item.eventId === event.id && item.personId === filter.personId)
    ) {
      return false;
    }
    return true;
  });

  const eventIds = new Set(eligibleEvents.map((event) => event.id));
  const participantMap = new Map<string, WorkParticipant>();
  participants
    .filter((item) => eventIds.has(item.eventId))
    .forEach((item) => {
      const key = `${item.eventId}:${item.personId}`;
      const existing = participantMap.get(key);
      if (!existing || item.actualMinutes > existing.actualMinutes) participantMap.set(key, item);
    });
  const eligibleParticipants = [...participantMap.values()];
  const peopleById = new Map(people.map((item) => [item.id, item]));
  const typesById = new Map(workTypes.map((item) => [item.id, item]));
  const eventMinutes = new Map<string, number>();
  eligibleParticipants.forEach((item) => {
    eventMinutes.set(
      item.eventId,
      (eventMinutes.get(item.eventId) ?? 0) + Math.max(0, item.actualMinutes || 0),
    );
  });
  const customerMatches = Object.fromEntries(
    eligibleEvents.map((event) => [event.id, matchEventCustomer(event, customers, opportunities)]),
  );
  const customerGroups = buildCustomerGroups(eligibleEvents, customerMatches, eventMinutes);
  const coveredCustomerIds = new Set(
    Object.values(customerMatches)
      .filter((match) => match.category === 'opportunity')
      .map((match) => match.customerId)
      .filter((id): id is string => Boolean(id)),
  );
  const otherCustomerKeys = new Set(
    eligibleEvents
      .filter((event) => customerMatches[event.id]?.category === 'other')
      .map((event) => otherCustomerKey(event))
      .filter(Boolean),
  );
  const visitTypeIds = new Set(
    workTypes.filter((item) => item.code === 'customer_visit').map((item) => item.id),
  );

  const personMap = new Map<string, { id: string; name: string; eventIds: Set<string>; minutes: number }>();
  eligibleParticipants.forEach((item) => {
    const person = peopleById.get(item.personId);
    const current = personMap.get(item.personId) ?? {
      id: item.personId,
      name: person?.name ?? '已停用人员',
      eventIds: new Set<string>(),
      minutes: 0,
    };
    current.eventIds.add(item.eventId);
    current.minutes += Math.max(0, item.actualMinutes || 0);
    personMap.set(item.personId, current);
  });

  const typeMap = new Map<
    string,
    { id: string; name: string; color: string; eventIds: Set<string>; minutes: number }
  >();
  eligibleEvents.forEach((event) => {
    const typeId = event.workTypeId ?? 'missing-type';
    const type = typesById.get(typeId);
    const current = typeMap.get(typeId) ?? {
      id: typeId,
      name: type?.name ?? (typeId === 'missing-type' ? '未填写类型' : '已停用类型'),
      color: type?.color ?? '#94a3b8',
      eventIds: new Set<string>(),
      minutes: 0,
    };
    current.eventIds.add(event.id);
    current.minutes += eventMinutes.get(event.id) ?? 0;
    typeMap.set(typeId, current);
  });

  const peopleStats = [...personMap.values()]
    .map((item) => ({ id: item.id, name: item.name, eventCount: item.eventIds.size, minutes: item.minutes }))
    .sort(
      (a, b) => b.minutes - a.minutes || b.eventCount - a.eventCount || a.name.localeCompare(b.name, 'zh-CN'),
    );
  const typeStats = [...typeMap.values()]
    .map((item) => ({
      id: item.id,
      name: item.name,
      color: item.color,
      eventCount: item.eventIds.size,
      minutes: item.minutes,
    }))
    .sort(
      (a, b) => b.minutes - a.minutes || b.eventCount - a.eventCount || a.name.localeCompare(b.name, 'zh-CN'),
    );

  return {
    teamEventCount: eventIds.size,
    personalEventCount: new Set(eligibleParticipants.map((item) => `${item.eventId}:${item.personId}`)).size,
    totalMinutes: eligibleParticipants.reduce(
      (total, item) => total + Math.max(0, item.actualMinutes || 0),
      0,
    ),
    customerCount: coveredCustomerIds.size,
    otherCustomerCount: otherCustomerKeys.size,
    unlinkedEventCount: Object.values(customerMatches).filter((match) => match.category === 'unlinked')
      .length,
    visitCount: eligibleEvents.filter((event) =>
      Boolean(event.workTypeId && visitTypeIds.has(event.workTypeId)),
    ).length,
    people: peopleStats,
    types: typeStats,
    customers: customerGroups,
    customerMatches,
  };
}

function eventMatchesCustomerQuery(
  event: WorkEvent,
  customers: CustomerMapping[],
  customersById: Map<string, CustomerMapping>,
  query: string,
) {
  const matchedCustomer = findEventCustomer(event, customers, customersById);
  return matchesCustomerSearch(query, [
    event.customerNameSnapshot,
    matchedCustomer?.canonicalName ?? '',
    ...(matchedCustomer?.aliases ?? []),
  ]);
}

function findEventCustomer(
  event: WorkEvent,
  customers: CustomerMapping[],
  customersById: Map<string, CustomerMapping>,
) {
  return (
    (event.customerId ? customersById.get(event.customerId) : undefined) ??
    findUniqueCustomerMatch(event.customerNameSnapshot, customers)
  );
}

export function matchEventCustomer(
  event: WorkEvent,
  customers: CustomerMapping[],
  opportunities: OpportunityMapping[],
): CustomerMatchResult {
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const opportunitiesById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));
  const opportunityCustomerIds = new Set(opportunities.map((opportunity) => opportunity.customerId));

  const linkedOpportunity = event.opportunityId ? opportunitiesById.get(event.opportunityId) : undefined;
  if (linkedOpportunity && opportunityCustomerIds.has(linkedOpportunity.customerId)) {
    const customer = customersById.get(linkedOpportunity.customerId);
    return standardCustomerMatch(
      linkedOpportunity.customerId,
      customer?.canonicalName ?? '已导入客户',
      'opportunity',
    );
  }

  if (event.customerId && opportunityCustomerIds.has(event.customerId)) {
    const customer = customersById.get(event.customerId);
    return standardCustomerMatch(event.customerId, customer?.canonicalName ?? '已导入客户', 'customer');
  }

  const linkedCustomer = event.customerId ? customersById.get(event.customerId) : undefined;
  const sourceNames = [
    event.customerNameSnapshot,
    linkedCustomer?.canonicalName ?? '',
    ...(linkedCustomer?.aliases ?? []),
  ].filter((name) => normalizeBusinessName(name));

  if (sourceNames.length === 0) {
    return {
      category: 'unlinked',
      key: 'unlinked',
      name: '未关联客户',
      reason: 'missing',
      candidateCustomerIds: [],
    };
  }

  const standardCustomers = customers.filter((customer) => opportunityCustomerIds.has(customer.id));
  const candidates = standardCustomers.filter((customer) =>
    sourceNames.some((name) => matchesCustomerSearch(name, [customer.canonicalName, ...customer.aliases])),
  );
  if (candidates.length === 1) {
    return standardCustomerMatch(candidates[0].id, candidates[0].canonicalName, 'fuzzy');
  }

  return {
    category: 'other',
    key: 'other',
    name: '其他',
    reason: candidates.length > 1 ? 'ambiguous' : 'unmatched',
    candidateCustomerIds: candidates.map((customer) => customer.id),
  };
}

function standardCustomerMatch(
  customerId: string,
  name: string,
  reason: Extract<CustomerMatchReason, 'opportunity' | 'customer' | 'fuzzy'>,
): CustomerMatchResult {
  return {
    category: 'opportunity',
    key: `customer:${customerId}`,
    customerId,
    name,
    reason,
    candidateCustomerIds: [customerId],
  };
}

function buildCustomerGroups(
  events: WorkEvent[],
  matches: Record<string, CustomerMatchResult>,
  eventMinutes: Map<string, number>,
) {
  const groups = new Map<string, CustomerMatchResult & { eventIds: string[]; minutes: number }>();
  events.forEach((event) => {
    const match = matches[event.id];
    const group = groups.get(match.key) ?? { ...match, eventIds: [], minutes: 0 };
    group.eventIds.push(event.id);
    group.minutes += eventMinutes.get(event.id) ?? 0;
    groups.set(match.key, group);
  });

  const items: CustomerWorkloadItem[] = [...groups.values()].map((group) => ({
    key: group.key,
    category: group.category,
    customerId: group.customerId,
    name: group.name,
    eventCount: group.eventIds.length,
    minutes: group.minutes,
    eventIds: group.eventIds,
  }));
  const standard = items
    .filter((item) => item.category === 'opportunity')
    .sort(
      (a, b) => b.minutes - a.minutes || b.eventCount - a.eventCount || a.name.localeCompare(b.name, 'zh-CN'),
    );
  const fixedBuckets = ['other', 'unlinked']
    .map((key) => items.find((item) => item.key === key))
    .filter((item): item is CustomerWorkloadItem => Boolean(item));
  return [...standard, ...fixedBuckets];
}

function otherCustomerKey(event: WorkEvent) {
  if (event.customerId) return `id:${event.customerId}`;
  const name = normalizeBusinessName(event.customerNameSnapshot);
  return name ? `name:${name}` : '';
}

function findUniqueCustomerMatch(name: string, customers: CustomerMapping[]) {
  const normalizedName = normalizeBusinessName(name);
  if (!normalizedName) return undefined;
  const matches = customers.filter((customer) =>
    matchesCustomerSearch(name, [customer.canonicalName, ...customer.aliases]),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function formatDuration(minutes: number) {
  if (minutes <= 0) return '0 小时';
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`;
}
