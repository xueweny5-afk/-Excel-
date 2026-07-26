import { describe, expect, it } from 'vitest';
import type {
  CustomerMapping,
  OpportunityMapping,
  Person,
  WorkEvent,
  WorkParticipant,
  WorkType,
} from '../domain';
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

const customers: CustomerMapping[] = [
  {
    id: 'c1',
    canonicalName: '客户一',
    sourceKey: 'customer:1',
    aliases: ['一号客户'],
    matchStatus: 'matched',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'c2',
    canonicalName: '客户二',
    sourceKey: 'customer:2',
    aliases: ['二号客户'],
    matchStatus: 'matched',
    createdAt: '',
    updatedAt: '',
  },
];

const opportunities: OpportunityMapping[] = [
  {
    id: 'o1',
    customerId: 'c1',
    canonicalName: '商机一',
    sourceKey: 'opportunity:1',
    aliases: [],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'o2',
    customerId: 'c2',
    canonicalName: '商机二',
    sourceKey: 'opportunity:2',
    aliases: [],
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
    const stats = buildWorkloadStats(events, participants, people, workTypes, customers, opportunities);
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
    const stats = buildWorkloadStats(events, participants, people, workTypes, customers, opportunities);
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
    const stats = buildWorkloadStats(
      [event('e1', 'completed'), second],
      participants,
      people,
      workTypes,
      customers,
      opportunities,
      {
        personId: 'p2',
        workTypeId: 'solution',
        from: '2026-08-01',
        to: '2026-08-31',
      },
    );
    expect(stats.teamEventCount).toBe(1);
    expect(stats.totalMinutes).toBe(120);
    expect(stats.customerCount).toBe(1);
  });

  it('快速备忘录直接勾选完成后计入团队次数，未填写人员和类型不虚构个人时长', () => {
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
      teamEventCount: 1,
      personalEventCount: 0,
      totalMinutes: 0,
    });
    expect(buildWorkloadStats([quickDraft], [], people, workTypes).types[0]).toMatchObject({
      name: '未填写类型',
      eventCount: 1,
      minutes: 0,
    });
  });

  it('客户名称没有编号时，会按已导入客户做唯一模糊归并统计', () => {
    const fuzzyCustomers: CustomerMapping[] = [
      {
        id: 'customer-zj',
        canonicalName: '紫金山实验室',
        sourceKey: 'customer:zj',
        aliases: ['紫金山'],
        matchStatus: 'matched',
        createdAt: '',
        updatedAt: '',
      },
    ];
    const fuzzyOpportunities: OpportunityMapping[] = [
      {
        id: 'opportunity-zj',
        customerId: 'customer-zj',
        canonicalName: '实验室建设',
        sourceKey: 'opportunity:zj',
        aliases: [],
        createdAt: '',
        updatedAt: '',
      },
    ];
    const first = { ...event('e1', 'completed', 'visit', ''), customerNameSnapshot: '紫金山' };
    const second = { ...event('e2', 'completed', 'visit', ''), customerNameSnapshot: '紫金山实验室' };

    const stats = buildWorkloadStats(
      [first, second],
      [],
      people,
      workTypes,
      fuzzyCustomers,
      fuzzyOpportunities,
    );

    expect(stats.teamEventCount).toBe(2);
    expect(stats.customerCount).toBe(1);
    expect(stats.customers[0]).toMatchObject({
      customerId: 'customer-zj',
      eventCount: 2,
    });
    expect(stats.customerMatches.e1.reason).toBe('fuzzy');
  });

  it('按商机、客户编号、唯一模糊命中依次归类，其他和未关联客户分开统计', () => {
    const scopedCustomers: CustomerMapping[] = [
      {
        ...customers[0],
        canonicalName: '江苏省人民医院',
        aliases: ['省人民医院'],
      },
      {
        ...customers[1],
        canonicalName: '浙江省人民医院',
        aliases: ['省人民医院'],
      },
      {
        id: 'c3',
        canonicalName: '历史客户',
        sourceKey: 'customer:3',
        aliases: [],
        matchStatus: 'matched',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'temporary',
        canonicalName: '新客户',
        sourceKey: 'manual:temporary',
        aliases: ['新客户'],
        matchStatus: 'pending',
        createdAt: '',
        updatedAt: '',
      },
    ];
    const byOpportunity = {
      ...event('by-opportunity', 'completed', 'visit', 'c2'),
      opportunityId: 'o1',
      customerNameSnapshot: '浙江省人民医院',
    };
    const byCustomer = {
      ...event('by-customer', 'completed', 'visit', 'c2'),
      customerNameSnapshot: '浙江省人民医院',
    };
    const byFuzzy = {
      ...event('by-fuzzy', 'completed', 'visit', ''),
      customerNameSnapshot: '江苏省人民医院',
    };
    const ambiguous = {
      ...event('ambiguous', 'completed', 'visit', ''),
      customerNameSnapshot: '省人民医院',
    };
    const unmatched = {
      ...event('unmatched', 'completed', 'visit', 'temporary'),
      customerNameSnapshot: '新客户',
    };
    const notOpportunityCustomer = {
      ...event('not-opportunity-customer', 'completed', 'visit', 'c3'),
      customerNameSnapshot: '历史客户',
    };
    const missing = {
      ...event('missing', 'completed', 'visit', ''),
      customerNameSnapshot: '',
    };

    const stats = buildWorkloadStats(
      [byOpportunity, byCustomer, byFuzzy, ambiguous, unmatched, notOpportunityCustomer, missing],
      [],
      people,
      workTypes,
      scopedCustomers,
      opportunities,
    );

    expect(stats.customerMatches['by-opportunity']).toMatchObject({
      customerId: 'c1',
      reason: 'opportunity',
    });
    expect(stats.customerMatches['by-customer']).toMatchObject({ customerId: 'c2', reason: 'customer' });
    expect(stats.customerMatches['by-fuzzy']).toMatchObject({ customerId: 'c1', reason: 'fuzzy' });
    expect(stats.customerMatches.ambiguous).toMatchObject({ category: 'other', reason: 'ambiguous' });
    expect(stats.customerMatches.unmatched).toMatchObject({ category: 'other', reason: 'unmatched' });
    expect(stats.customerMatches['not-opportunity-customer']).toMatchObject({
      category: 'other',
      reason: 'unmatched',
    });
    expect(stats.customerMatches.missing).toMatchObject({ category: 'unlinked', reason: 'missing' });
    expect(stats.customerCount).toBe(2);
    expect(stats.otherCustomerCount).toBe(3);
    expect(stats.unlinkedEventCount).toBe(1);
    expect(stats.customers.map((item) => item.key).slice(-2)).toEqual(['other', 'unlinked']);
  });
});
