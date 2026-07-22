import type { WorkEvent, WorkParticipant } from './domain';

export function createQuickWorkEvent(input: {
  id: string;
  content: string;
  date: string;
  timestamp: string;
}): WorkEvent {
  const content = input.content.trim();
  return {
    id: input.id,
    title: quickWorkTitle(content),
    status: 'planned',
    entryMode: 'quick',
    allDay: true,
    startAt: `${input.date}T00:00:00`,
    endAt: `${input.date}T23:59:59`,
    customerNameSnapshot: '',
    opportunityNameSnapshot: '',
    workMode: '',
    location: '',
    content,
    result: '',
    nextAction: '',
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  };
}

export function quickWorkTitle(content: string) {
  return (
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  ).slice(0, 120);
}

export function completionValidationMessage(event: WorkEvent, participants: WorkParticipant[]) {
  if (!event.ownerId) return '请选择负责人。';
  if (!event.workTypeId) return '请选择工作类型。';
  if (event.allDay) return '请填写具体的开始和结束时间。';
  if (!participants.some((item) => item.personId === event.ownerId)) return '负责人必须包含在参与人员中。';
  return '';
}
