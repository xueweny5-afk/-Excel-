import { describe, expect, it } from 'vitest';
import type { Person, WorkEvent, WorkParticipant, WorkType } from '../domain';
import { buildWorkloadStats } from '../statistics';

const people: Person[] = [
  {
    id: 'p1',
    name: '张三',
    normalizedName: '张三',
    status: 'active',
    sortOrder: 10,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'p2',
    name: '李四',
    normalizedName: '李四',
    status: 'inactive',
    sortOrder: 20,
    createdAt: '',
    updatedAt: '',
  },
];

const workTypes: WorkType[] = [
  {
    id: 'visit',
    code: 'customer_visit',
    name: '客户拜访',
    color: '#2563eb',
    status: 'active',
    sortOrder: 10,
    isSystem: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'solution',
    code: 'solution_writing',
    name: '方案编写',
    color: '#8b5cf6',
    status: 'inactive',
    sortOrder: 20,
    isSystem: true,
    createdAt: '',
    updatedAt: '',
  },
];

function event(id: string, status: WorkEvent['status'], type = 'visit', customerId = 'c1'): WorkEvent {
  return {
    id,
    title: id,
    status,
    startAt: '2026-07-01T09:00:00',
    endAt: '2026-07-01T10:00:00',
    workTypeId: type,
    ownerId: 'p1',
    customerId,
    customerNameSnapshot: customerId,
    opportunityNameSnapshot: '',
    workMode: '现场',
    location: '',
    content: '',
    result: '',
    nextAction: '',
    createdAt: '',
    updatedAt: '',
  };
}

describe('buildWorkloadStats', () => {
  it('只统计已完成事件，并区分团队次数、个人次数和个人时长', () => {
    const events = [event('e1', 'completed'), event('e2', 'planned'), event('e3', 'cancelled')];
    const participants: WorkParticipant[] = [
      { id: 'e1:p1', eventId: 'e1', personId: 'p1', actualMinutes: 60 },
      { id: 'e1:p2', eventId: 'e1', personId: 'p2', actualMinutes: 90 },
      { id: 'e2:p1', eventId: 'e2', personId: 'p1', actualMinutes: 120 },
      { id: 'e3:p1', eventId: 'e3', personId: 'p1', actualMinutes: 180 },
    ];
    const stats = buildWorkloadStats(events, participants, people, workTypes);
    expect(stats.teamEventCount).toBe(1);
    expect(stats.personalEventCount).toBe(2);
    expect(stats.totalMinutes).toBe(150);
    expect(stats.customerCount).toBe(1);
    expect(stats.visitCount).toBe(1);
  });

  it('重复参与人不会重复计算时长，停用人员和类型仍保留历史统计', () => {
    const events = [event('e1', 'completed', 'solution')];
    const participants: WorkParticipant[] = [
      { id: 'duplicate-1', eventId: 'e1', personId: 'p2', actualMinutes: 60 },
      { id: 'duplicate-2', eventId: 'e1', personId: 'p2', actualMinutes: 60 },
    ];
    const stats = buildWorkloadStats(events, participants, people, workTypes);
    expect(stats.personalEventCount).toBe(1);
    expect(stats.totalMinutes).toBe(60);
    expect(stats.people[0].name).toBe('李四');
    expect(stats.types[0].name).toBe('方案编写');
  });

  it('人员、类型、日期筛选口径正确', () => {
    const second = { ...event('e2', 'completed', 'solution', 'c2'), startAt: '2026-08-01T09:00:00' };
    const participants: WorkParticipant[] = [
      { id: 'e1:p1', eventId: 'e1', personId: 'p1', actualMinutes: 60 },
      { id: 'e2:p2', eventId: 'e2', personId: 'p2', actualMinutes: 120 },
    ];
    const stats = buildWorkloadStats([event('e1', 'completed'), second], participants, people, workTypes, {
      personId: 'p2',
      workTypeId: 'solution',
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(stats.teamEventCount).toBe(1);
    expect(stats.totalMinutes).toBe(120);
    expect(stats.customerCount).toBe(1);
  });

  it('快速备忘录即使直接勾选完成，没有负责人和类型时也不进入统计', () => {
    const quickDraft: WorkEvent = {
      id: 'draft',
      title: '准备交流材料',
      status: 'completed',
      entryMode: 'quick',
      allDay: true,
      startAt: '2026-08-02T00:00:00',
      endAt: '2026-08-02T23:59:59',
      customerNameSnapshot: '',
      opportunityNameSnapshot: '',
      workMode: '',
      location: '',
      content: '',
      result: '',
      nextAction: '',
      createdAt: '',
      updatedAt: '',
    };
    expect(buildWorkloadStats([quickDraft], [], people, workTypes)).toMatchObject({
      teamEventCount: 0,
      personalEventCount: 0,
      totalMinutes: 0,
    });
  });
});
