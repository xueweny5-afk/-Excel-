import type { Person, WorkEvent, WorkParticipant, WorkType } from './domain';

export interface WorkloadStats {
  teamEventCount: number;
  personalEventCount: number;
  totalMinutes: number;
  customerCount: number;
  visitCount: number;
  people: Array<{ id: string; name: string; eventCount: number; minutes: number }>;
  types: Array<{ id: string; name: string; color: string; eventCount: number; minutes: number }>;
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
  filter: WorkloadFilter = {},
): WorkloadStats {
  const eligibleEvents = events.filter((event) => {
    if (event.status !== 'completed') return false;
    if (event.entryMode === 'quick' || event.allDay || !event.ownerId || !event.workTypeId) return false;
    if (filter.from && event.startAt.slice(0, 10) < filter.from) return false;
    if (filter.to && event.startAt.slice(0, 10) > filter.to) return false;
    if (filter.workTypeId && event.workTypeId !== filter.workTypeId) return false;
    if (
      filter.customerQuery &&
      !event.customerNameSnapshot.toLowerCase().includes(filter.customerQuery.toLowerCase())
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
  const customerIds = new Set(
    eligibleEvents.map((event) => event.customerId || event.customerNameSnapshot.trim()).filter(Boolean),
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
      name: type?.name ?? '已停用类型',
      color: type?.color ?? '#94a3b8',
      eventIds: new Set<string>(),
      minutes: 0,
    };
    current.eventIds.add(event.id);
    current.minutes += eligibleParticipants
      .filter((item) => item.eventId === event.id)
      .reduce((total, item) => total + Math.max(0, item.actualMinutes || 0), 0);
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
    customerCount: customerIds.size,
    visitCount: eligibleEvents.filter((event) =>
      Boolean(event.workTypeId && visitTypeIds.has(event.workTypeId)),
    ).length,
    people: peopleStats,
    types: typeStats,
  };
}

export function formatDuration(minutes: number) {
  if (minutes <= 0) return '0 小时';
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`;
}
