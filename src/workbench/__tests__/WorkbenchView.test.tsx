import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardData } from '../../domain';
import { fireEvent, render, screen, waitFor } from '../../test/testUtils';
import type { ImportCaptureResult, WorkEvent, WorkbenchData } from '../domain';
import { WorkbenchView } from '../WorkbenchView';

const mocks = vi.hoisted(() => ({
  initializeWorkbench: vi.fn(),
  loadWorkbenchData: vi.fn(),
  deleteWorkEvent: vi.fn(),
  saveWorkEvent: vi.fn(),
  parseDashboardFile: vi.fn(),
  captureDashboardImport: vi.fn(),
  createTemporaryCustomer: vi.fn(),
}));

vi.mock('../../lib/parser', () => ({ parseDashboardFile: mocks.parseDashboardFile }));
vi.mock('../db', () => ({
  captureDashboardImport: mocks.captureDashboardImport,
  createTemporaryCustomer: mocks.createTemporaryCustomer,
  deleteWorkEvent: mocks.deleteWorkEvent,
  exportWorkbenchBackup: vi.fn(),
  initializeWorkbench: mocks.initializeWorkbench,
  loadWorkbenchData: mocks.loadWorkbenchData,
  newId: () => 'quick-event-id',
  normalizeBusinessName: (value: string) => value.trim().toLowerCase(),
  restoreWorkbenchBackup: vi.fn(),
  savePerson: vi.fn(),
  saveTestProject: vi.fn(),
  saveWorkEvent: mocks.saveWorkEvent,
  saveWorkType: vi.fn(),
}));

const emptyData: WorkbenchData = {
  people: [],
  workTypes: [],
  events: [],
  eventRevisions: [],
  participants: [],
  testProjects: [],
  customers: [],
  opportunities: [],
  snapshots: [],
  importBatches: [],
};

const dashboardData: DashboardData = {
  ppl: [],
  summary: [],
  activity: [],
  performance: [],
  report: {
    fileName: 'workbench.xlsx',
    importedAt: '2026-07-19',
    pplRows: 0,
    summaryRows: 0,
    activityRows: 0,
    performanceRows: 0,
    skippedRows: 0,
    detectedFields: [],
    missingFields: [],
    warnings: [],
  },
};

function dateText(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function quickEvent(id: string, title: string, date: string): WorkEvent {
  return {
    id,
    title,
    status: 'planned',
    entryMode: 'quick',
    allDay: true,
    startAt: `${date}T00:00:00`,
    endAt: `${date}T23:59:59`,
    customerNameSnapshot: '',
    opportunityNameSnapshot: '',
    workMode: '',
    location: '',
    content: '',
    result: '',
    nextAction: '',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
  };
}

describe('WorkbenchView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.initializeWorkbench.mockResolvedValue(undefined);
    mocks.loadWorkbenchData.mockResolvedValue(emptyData);
    mocks.deleteWorkEvent.mockResolvedValue(undefined);
    mocks.saveWorkEvent.mockResolvedValue(undefined);
    mocks.createTemporaryCustomer.mockResolvedValue({
      id: 'temporary-customer',
      canonicalName: '临时客户',
      sourceKey: 'manual:temporary',
      aliases: ['临时客户'],
      matchStatus: 'pending',
      createdAt: '',
      updatedAt: '',
    });
  });

  it('can drag a calendar event to another date and keep its time', async () => {
    const moved = {
      ...quickEvent('drag-event', 'Move meeting', '2026-07-01'),
      allDay: false,
      startAt: '2026-07-01T10:30:00',
      endAt: '2026-07-01T11:45:00',
    };
    mocks.loadWorkbenchData.mockResolvedValue({ ...emptyData, events: [moved] });
    const { container } = render(<WorkbenchView />);
    await waitFor(() => expect(container.querySelector('.workbench-module')).not.toBeNull());

    const pill = container.querySelector<HTMLElement>('.work-event-pill');
    const targetEvents = container.querySelector<HTMLElement>(
      '.calendar-day-events[aria-label^="2026-07-02"]',
    );
    const targetDay = targetEvents?.closest<HTMLElement>('.calendar-day');
    expect(pill).not.toBeNull();
    expect(targetDay).not.toBeNull();

    const dataTransfer = {
      dropEffect: '',
      effectAllowed: '',
      setData: vi.fn(),
      getData: vi.fn(),
    };
    fireEvent.dragStart(pill!, { dataTransfer });
    fireEvent.dragOver(targetDay!, { dataTransfer });
    fireEvent.drop(targetDay!, { dataTransfer });

    await waitFor(() =>
      expect(mocks.saveWorkEvent).toHaveBeenCalledWith({
        event: expect.objectContaining({
          id: 'drag-event',
          startAt: '2026-07-02T10:30:00',
          endAt: '2026-07-02T11:45:00',
        }),
        participants: [],
      }),
    );
  });

  it('does not show the import overlay while dragging calendar events', async () => {
    mocks.loadWorkbenchData.mockResolvedValue({
      ...emptyData,
      events: [quickEvent('drag-event', 'Move meeting', '2026-07-01')],
    });
    const { container } = render(<WorkbenchView />);
    await waitFor(() => expect(container.querySelector('.workbench-module')).not.toBeNull());

    const pill = container.querySelector<HTMLElement>('.work-event-pill');
    expect(pill).not.toBeNull();
    fireEvent.dragStart(pill!, {
      dataTransfer: {
        dropEffect: '',
        effectAllowed: '',
        types: ['text/plain'],
        setData: vi.fn(),
        getData: vi.fn(),
      },
    });

    expect(screen.queryByText('松开鼠标，将数据导入售前工作台')).not.toBeInTheDocument();
  });

  it('still shows the import overlay when dragging files into the workbench', async () => {
    const { container } = render(<WorkbenchView />);
    await waitFor(() => expect(container.querySelector('.workbench-module')).not.toBeNull());

    fireEvent.dragEnter(container.querySelector('.workbench-module')!, {
      dataTransfer: {
        types: ['Files'],
      },
    });

    expect(screen.getByText('松开鼠标，将数据导入售前工作台')).toBeInTheDocument();
  });

  it('can save an all-day incomplete draft as completed without required owner or type', async () => {
    const draft = {
      ...quickEvent('completed-draft', 'Draft done', '2026-07-21'),
      content: 'Draft done content',
      customerId: 'customer-zj',
      customerNameSnapshot: '紫金山实验室',
    };
    mocks.loadWorkbenchData.mockResolvedValue({
      ...emptyData,
      events: [draft],
      customers: [
        {
          id: 'customer-zj',
          canonicalName: '紫金山实验室',
          sourceKey: 'customer:zj',
          aliases: [],
          matchStatus: 'matched',
          createdAt: '2026-07-20T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
      ],
    });
    const confirm = vi.spyOn(window, 'confirm');
    const { container } = render(<WorkbenchView />);
    await waitFor(() => expect(container.querySelector('.workbench-module')).not.toBeNull());

    const calendarTitle = screen
      .getAllByText('Draft done')
      .find((node) => node.closest('.calendar-day-events'));
    expect(calendarTitle).toBeDefined();
    fireEvent.click(calendarTitle!.closest('button')!);
    fireEvent.change(screen.getByLabelText('状态'), { target: { value: 'completed' } });
    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    await waitFor(() =>
      expect(mocks.saveWorkEvent).toHaveBeenCalledWith({
        event: expect.objectContaining({
          id: 'completed-draft',
          status: 'completed',
          allDay: true,
          ownerId: undefined,
          workTypeId: undefined,
        }),
        participants: [],
      }),
    );
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('完整录入里的客户和关联商机支持模糊搜索选择', async () => {
    mocks.loadWorkbenchData.mockResolvedValue({
      ...emptyData,
      people: [
        {
          id: 'person-1',
          name: '陈飞',
          normalizedName: '陈飞',
          status: 'active',
          sortOrder: 1,
          createdAt: '2026-07-20T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
      ],
      workTypes: [
        {
          id: 'type-1',
          code: 'customer_exchange',
          name: '客户交流',
          color: '#2563eb',
          status: 'active',
          sortOrder: 1,
          isSystem: true,
          createdAt: '2026-07-20T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
      ],
      customers: [
        {
          id: 'customer-zj',
          canonicalName: '紫金山实验室',
          sourceKey: 'customer:zj',
          aliases: ['紫金山'],
          matchStatus: 'matched',
          createdAt: '2026-07-20T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
        {
          id: 'customer-other',
          canonicalName: '其他客户',
          sourceKey: 'customer:other',
          aliases: [],
          matchStatus: 'matched',
          createdAt: '2026-07-20T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
      ],
      opportunities: [
        {
          id: 'opportunity-ds',
          customerId: 'customer-zj',
          canonicalName: 'DS汇报项目',
          sourceKey: 'opportunity:ds',
          aliases: ['DS'],
          createdAt: '2026-07-20T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
        {
          id: 'opportunity-other',
          customerId: 'customer-other',
          canonicalName: '不应出现的商机',
          sourceKey: 'opportunity:other',
          aliases: [],
          createdAt: '2026-07-20T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
      ],
    });
    render(<WorkbenchView />);
    await screen.findByText('本地持久化已启用');

    fireEvent.click(screen.getByRole('button', { name: '完整录入工作' }));
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '紫金山实验室DS汇报' } });

    const customerInput = screen.getByPlaceholderText('输入客户简称或全称搜索');
    fireEvent.focus(customerInput);
    fireEvent.change(customerInput, { target: { value: '紫金' } });
    fireEvent.click(await screen.findByRole('button', { name: '紫金山实验室' }));

    const opportunityInput = screen.getByPlaceholderText('输入商机名称搜索');
    fireEvent.focus(opportunityInput);
    fireEvent.change(opportunityInput, { target: { value: 'DS' } });
    expect(screen.queryByText('不应出现的商机')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'DS汇报项目' }));

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    await waitFor(() =>
      expect(mocks.saveWorkEvent).toHaveBeenCalledWith({
        event: expect.objectContaining({
          customerId: 'customer-zj',
          customerNameSnapshot: '紫金山实验室',
          opportunityId: 'opportunity-ds',
          opportunityNameSnapshot: 'DS汇报项目',
        }),
        participants: expect.any(Array),
      }),
    );
  });

  it('临时填写的客户名称唯一模糊命中导入客户时，保存为已导入客户用于统计', async () => {
    mocks.loadWorkbenchData.mockResolvedValue({
      ...emptyData,
      customers: [
        {
          id: 'customer-zj',
          canonicalName: '紫金山实验室',
          sourceKey: 'customer:zj',
          aliases: ['紫金山'],
          matchStatus: 'matched',
          createdAt: '2026-07-20T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
      ],
    });
    render(<WorkbenchView />);
    await screen.findByText('本地持久化已启用');

    fireEvent.click(screen.getByRole('button', { name: '完整录入工作' }));
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '紫金山客户沟通' } });

    const customerInput = screen.getByPlaceholderText('输入客户简称或全称搜索');
    fireEvent.focus(customerInput);
    fireEvent.change(customerInput, { target: { value: '临时' } });
    fireEvent.click(await screen.findByRole('button', { name: '＋ 临时录入新客户' }));
    fireEvent.change(screen.getByPlaceholderText('将标记为待匹配'), { target: { value: '紫金山' } });

    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    await waitFor(() =>
      expect(mocks.saveWorkEvent).toHaveBeenCalledWith({
        event: expect.objectContaining({
          customerId: 'customer-zj',
          customerNameSnapshot: '紫金山实验室',
        }),
        participants: [],
      }),
    );
    expect(mocks.createTemporaryCustomer).not.toHaveBeenCalled();
  });

  it('单击日期只选中，双击日期后可直接填写具体内容并创建全天计划草稿', async () => {
    const today = dateText();
    mocks.loadWorkbenchData.mockResolvedValueOnce(emptyData).mockResolvedValueOnce({
      ...emptyData,
      events: [quickEvent('quick-event-id', '准备客户交流材料', today)],
    });
    render(<WorkbenchView />);
    await screen.findByText('本地持久化已启用');

    const dateButton = screen.getByRole('button', { name: `选择 ${today}` });
    fireEvent.click(dateButton);
    expect(screen.queryByPlaceholderText('直接填写具体工作内容，首行作为标题')).not.toBeInTheDocument();

    fireEvent.doubleClick(dateButton);
    const input = screen.getByPlaceholderText('直接填写具体工作内容，首行作为标题');
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.change(input, { target: { value: '准备客户交流材料\n确认演示范围和时间' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    await waitFor(() => expect(mocks.saveWorkEvent).toHaveBeenCalledTimes(1));
    expect(mocks.saveWorkEvent.mock.calls[0][0]).toMatchObject({
      event: {
        id: 'quick-event-id',
        title: '准备客户交流材料',
        status: 'planned',
        entryMode: 'quick',
        allDay: true,
        content: '准备客户交流材料\n确认演示范围和时间',
      },
      participants: [],
    });
    const createdLabels = await screen.findAllByText('准备客户交流材料');
    expect(createdLabels.some((label) => label.closest('button')?.classList.contains('just-created'))).toBe(
      true,
    );
    expect(screen.getByRole('status')).toHaveTextContent('已添加到');
  });

  it('快速新增浮层可用 Escape 关闭', async () => {
    render(<WorkbenchView />);
    await screen.findByText('本地持久化已启用');

    fireEvent.doubleClick(screen.getByRole('button', { name: `选择 ${dateText()}` }));
    const input = screen.getByPlaceholderText('直接填写具体工作内容，首行作为标题');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByPlaceholderText('直接填写具体工作内容，首行作为标题')).not.toBeInTheDocument();
  });

  it('日历事项优先显示工作名称，不显示待完善或客户名称', async () => {
    const today = dateText();
    mocks.loadWorkbenchData.mockResolvedValue({
      ...emptyData,
      events: [
        {
          ...quickEvent('event-title', '准备方案交流材料', today),
          customerNameSnapshot: '某客户有限公司',
        },
      ],
    });
    render(<WorkbenchView />);
    await screen.findByText('本地持久化已启用');

    const eventList = screen.getByLabelText(`${today} 工作列表`);
    expect(eventList).toHaveTextContent('准备方案交流材料');
    expect(eventList).not.toHaveTextContent('待完善');
    expect(eventList).not.toHaveTextContent('某客户有限公司');
  });

  it('可以从编辑抽屉永久删除误建工作', async () => {
    const today = dateText();
    const mistakenEvent = quickEvent('mistaken-event', '误建工作', today);
    let storedData = { ...emptyData, events: [mistakenEvent] };
    mocks.loadWorkbenchData.mockImplementation(() => Promise.resolve(storedData));
    mocks.deleteWorkEvent.mockImplementation(async () => {
      storedData = { ...emptyData };
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<WorkbenchView />);
    await screen.findByText('本地持久化已启用');

    const calendarTitle = screen
      .getAllByText('误建工作')
      .find((node) => node.closest('.calendar-day-events'));
    expect(calendarTitle).toBeDefined();
    fireEvent.click(calendarTitle!.closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: '删除记录' }));

    await waitFor(() => expect(mocks.deleteWorkEvent).toHaveBeenCalledWith('mistaken-event'));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('删除后无法恢复'));
    await waitFor(() => expect(screen.queryByText('误建工作')).not.toBeInTheDocument());
    confirm.mockRestore();
  });

  it('日历事项可以直接勾选完成并划掉，也可以恢复为计划中', async () => {
    const today = dateText();
    const planned = quickEvent('event-toggle', '跟进客户反馈', today);
    const completed = { ...planned, status: 'completed' as const };
    mocks.loadWorkbenchData
      .mockResolvedValueOnce({ ...emptyData, events: [planned] })
      .mockResolvedValueOnce({ ...emptyData, events: [completed] })
      .mockResolvedValueOnce({ ...emptyData, events: [planned] });
    render(<WorkbenchView />);
    await screen.findByText('本地持久化已启用');

    fireEvent.click(screen.getByRole('button', { name: '勾选“跟进客户反馈”为已完成' }));
    await waitFor(() =>
      expect(mocks.saveWorkEvent).toHaveBeenLastCalledWith({
        event: expect.objectContaining({ id: 'event-toggle', status: 'completed' }),
        participants: [],
      }),
    );
    const restoreButton = await screen.findByRole('button', { name: '取消勾选“跟进客户反馈”' });
    expect(restoreButton.closest('.work-event-pill')).toHaveClass('completed');

    fireEvent.click(restoreButton);
    await waitFor(() =>
      expect(mocks.saveWorkEvent).toHaveBeenLastCalledWith({
        event: expect.objectContaining({ id: 'event-toggle', status: 'planned' }),
        participants: [],
      }),
    );
  });

  it('完成按钮不会触发拖拽，已完成事项可稳定恢复', async () => {
    const today = dateText();
    const completed = { ...quickEvent('event-restore', '恢复客户沟通', today), status: 'completed' as const };
    const planned = { ...completed, status: 'planned' as const };
    mocks.loadWorkbenchData
      .mockResolvedValueOnce({ ...emptyData, events: [completed] })
      .mockResolvedValueOnce({ ...emptyData, events: [planned] });
    render(<WorkbenchView />);
    await screen.findByText('本地持久化已启用');

    const restoreButton = screen.getByRole('button', { name: '取消勾选“恢复客户沟通”' });
    expect(restoreButton).toHaveAttribute('draggable', 'false');
    expect(restoreButton).toHaveAttribute('title', '点击恢复为未完成');

    const dataTransfer = {
      dropEffect: '',
      effectAllowed: '',
      setData: vi.fn(),
      getData: vi.fn(),
    };
    fireEvent.dragStart(restoreButton, { dataTransfer });
    expect(dataTransfer.setData).not.toHaveBeenCalled();

    fireEvent.click(restoreButton);
    await waitFor(() =>
      expect(mocks.saveWorkEvent).toHaveBeenCalledWith({
        event: expect.objectContaining({ id: 'event-restore', status: 'planned' }),
        participants: [],
      }),
    );
  });

  it('保存完整录入时校验结束时间必须晚于开始时间', async () => {
    mocks.loadWorkbenchData.mockResolvedValue({
      ...emptyData,
      people: [
        {
          id: 'person-1',
          name: '陈飞',
          normalizedName: '陈飞',
          status: 'active',
          sortOrder: 1,
          createdAt: '2026-07-20T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
      ],
    });
    render(<WorkbenchView />);
    await screen.findByText('本地持久化已启用');

    fireEvent.click(screen.getByRole('button', { name: '新增工作' }));
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '时间校验工作' } });
    const allDayCheckbox = screen.getByLabelText('全天或暂未安排具体时间');
    fireEvent.change(allDayCheckbox, { target: { checked: false } });
    expect(allDayCheckbox).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('开始时间'), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText('结束时间'), { target: { value: '09:00' } });
    fireEvent.click(screen.getByRole('button', { name: '保存记录' }));

    expect(await screen.findByText('结束时间必须晚于开始时间。')).toBeInTheDocument();
    expect(mocks.saveWorkEvent).not.toHaveBeenCalled();
  });

  it('月历日期格保留全部事项，由格内滚动承载溢出内容', async () => {
    const today = dateText();
    mocks.loadWorkbenchData.mockResolvedValue({
      ...emptyData,
      events: Array.from({ length: 7 }, (_, index) =>
        quickEvent(`event-${index + 1}`, `待办事项 ${index + 1}`, today),
      ),
    });
    render(<WorkbenchView />);
    await screen.findByText('本地持久化已启用');

    const eventList = screen.getByLabelText(`${today} 工作列表`);
    expect(eventList).toHaveClass('calendar-day-events');
    for (let index = 1; index <= 7; index += 1) {
      expect(screen.getAllByText(`待办事项 ${index}`).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText(/还有 \d+ 条/)).not.toBeInTheDocument();
  });

  it('客户筛选支持标准名称、历史别名和非连续关键词模糊匹配', async () => {
    const today = dateText();
    mocks.loadWorkbenchData.mockResolvedValue({
      ...emptyData,
      events: [
        {
          ...quickEvent('event-js', '江苏客户交流', today),
          customerId: 'customer-js',
          customerNameSnapshot: '江苏某某科技（集团）有限公司',
        },
        {
          ...quickEvent('event-zj', '浙江客户交流', today),
          customerNameSnapshot: '浙江某医疗有限公司',
        },
      ],
      customers: [
        {
          id: 'customer-js',
          canonicalName: '江苏某某科技集团有限公司',
          sourceKey: 'name:js',
          aliases: ['某某科技'],
          matchStatus: 'matched',
          createdAt: '2026-07-20T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
      ],
    });
    render(<WorkbenchView />);
    await screen.findByText('本地持久化已启用');

    fireEvent.change(screen.getByPlaceholderText('简称或关键词模糊搜索'), {
      target: { value: '江科' },
    });

    await waitFor(() => expect(screen.getAllByText('江苏客户交流').length).toBeGreaterThan(0));
    expect(screen.queryByText('浙江客户交流')).not.toBeInTheDocument();
  });

  it('工作量统计按商机客户归类，并支持下钻到其他、未关联及工作详情', async () => {
    const completedEvent = {
      ...quickEvent('event-customer', '客户方案交流', '2026-07-21'),
      status: 'completed' as const,
      entryMode: 'detailed' as const,
      allDay: false,
      startAt: '2026-07-21T09:00:00',
      endAt: '2026-07-21T10:00:00',
      workTypeId: 'type-communication',
      ownerId: 'person-1',
      customerNameSnapshot: '紫金山',
      opportunityNameSnapshot: '',
    };
    const otherEvent = {
      ...completedEvent,
      id: 'event-other',
      title: '新客户沟通',
      customerId: 'temporary-customer',
      customerNameSnapshot: '新客户',
    };
    const unlinkedEvent = {
      ...completedEvent,
      id: 'event-unlinked',
      title: '内部准备',
      customerNameSnapshot: '',
    };
    mocks.loadWorkbenchData.mockResolvedValue({
      ...emptyData,
      people: [
        {
          id: 'person-1',
          name: '陈飞',
          normalizedName: '陈飞',
          status: 'active',
          sortOrder: 1,
          createdAt: '',
          updatedAt: '',
        },
      ],
      workTypes: [
        {
          id: 'type-communication',
          code: 'customer_communication',
          name: '客户交流',
          color: '#2563eb',
          status: 'active',
          sortOrder: 1,
          isSystem: true,
          createdAt: '',
          updatedAt: '',
        },
      ],
      customers: [
        {
          id: 'customer-zj',
          canonicalName: '紫金山实验室',
          sourceKey: 'customer:zj',
          aliases: ['紫金山'],
          matchStatus: 'matched',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'temporary-customer',
          canonicalName: '新客户',
          sourceKey: 'manual:new',
          aliases: ['新客户'],
          matchStatus: 'pending',
          createdAt: '',
          updatedAt: '',
        },
      ],
      opportunities: [
        {
          id: 'opportunity-zj',
          customerId: 'customer-zj',
          canonicalName: '实验室建设项目',
          sourceKey: 'opportunity:zj',
          aliases: [],
          createdAt: '',
          updatedAt: '',
        },
      ],
      events: [completedEvent, otherEvent, unlinkedEvent],
      participants: [
        {
          id: 'event-customer:person-1',
          eventId: 'event-customer',
          personId: 'person-1',
          actualMinutes: 60,
        },
      ],
    });
    render(<WorkbenchView />);
    await screen.findByText('本地持久化已启用');

    fireEvent.click(screen.getByRole('button', { name: '工作量统计' }));
    expect(await screen.findByText('覆盖商机客户')).toBeInTheDocument();
    expect(screen.getByText('其他客户 1 个 · 未关联工作 1 条')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看紫金山实验室工作明细' }));
    expect(screen.getByRole('complementary', { name: '紫金山实验室工作明细' })).toBeInTheDocument();
    expect(screen.getByText('名称唯一模糊命中')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开工作详情：客户方案交流' }));
    expect(screen.getByRole('complementary', { name: '编辑工作' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '关闭' })[0]);
    expect(screen.getByRole('complementary', { name: '紫金山实验室工作明细' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '关闭客户工作明细' }));

    fireEvent.click(screen.getByRole('button', { name: '查看其他工作明细' }));
    expect(screen.getByText('未命中商机客户')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '关闭客户工作明细' }));

    fireEvent.click(screen.getByRole('button', { name: '查看未关联客户工作明细' }));
    expect(screen.getByText('工作未填写客户')).toBeInTheDocument();
  });

  it('工作台导入使用独立来源并显示增量结果', async () => {
    const result: ImportCaptureResult = {
      duplicate: false,
      identifiedPersonCount: 3,
      newPersonCount: 2,
      batch: {
        id: 'batch-1',
        sourceModule: 'workbench',
        fileName: 'workbench.xlsx',
        importedAt: '2026-07-19',
        fingerprint: 'fingerprint',
        sourceRowCount: 2,
        newCustomerCount: 1,
        newOpportunityCount: 2,
        changedSnapshotCount: 2,
        unchangedOpportunityCount: 0,
        duplicateSourceRowCount: 0,
      },
    };
    mocks.parseDashboardFile.mockResolvedValue(dashboardData);
    mocks.captureDashboardImport.mockResolvedValue(result);
    const { container } = render(<WorkbenchView />);
    await screen.findByText('本地持久化已启用');
    const input = container.querySelector<HTMLInputElement>('input[accept*=".xlsx"]');
    expect(input).not.toBeNull();
    const file = new File(['test'], 'workbench.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(input!, { target: { files: [file] } });

    await screen.findByText(/导入完成：新增客户 1 个、新增商机 2 个.*识别 3 人，新增 2 人/);
    expect(mocks.captureDashboardImport).toHaveBeenCalledWith({
      sourceModule: 'workbench',
      data: dashboardData,
    });
  });
});
