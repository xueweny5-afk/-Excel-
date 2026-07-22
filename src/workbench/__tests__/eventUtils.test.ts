import { describe, expect, it } from 'vitest';
import { completionValidationMessage, createQuickWorkEvent } from '../eventUtils';

describe('quick work event', () => {
  it('用具体内容首行生成标题并创建全天计划草稿，不虚构负责人、类型和时长', () => {
    const event = createQuickWorkEvent({
      id: 'event-1',
      content: '  准备客户交流材料  \n确认演示范围和时间',
      date: '2026-07-20',
      timestamp: '2026-07-19T10:00:00.000Z',
    });
    expect(event).toMatchObject({
      title: '准备客户交流材料',
      status: 'planned',
      entryMode: 'quick',
      allDay: true,
      startAt: '2026-07-20T00:00:00',
      content: '准备客户交流材料  \n确认演示范围和时间',
    });
    expect(event.ownerId).toBeUndefined();
    expect(event.workTypeId).toBeUndefined();
  });

  it('草稿缺少完整字段时不能标记完成', () => {
    const event = createQuickWorkEvent({
      id: 'event-1',
      content: '准备客户交流材料',
      date: '2026-07-20',
      timestamp: '2026-07-19T10:00:00.000Z',
    });
    expect(completionValidationMessage(event, [])).toBe('请选择负责人。');
    expect(
      completionValidationMessage({ ...event, ownerId: 'p1', workTypeId: 'type1', allDay: false }, [
        { id: 'event-1:p1', eventId: 'event-1', personId: 'p1', actualMinutes: 0 },
      ]),
    ).toBe('');
  });
});
