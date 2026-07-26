import { type DragEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { parseDashboardFile } from '../lib/parser';
import { matchesCustomerSearch } from './customerSearch';
import {
  captureDashboardImport,
  createTemporaryCustomer,
  deleteWorkEvent,
  exportWorkbenchBackup,
  initializeWorkbench,
  loadWorkbenchData,
  newId,
  normalizeBusinessName,
  restoreWorkbenchBackup,
  savePerson,
  saveTestProject,
  saveWorkEvent,
  saveWorkType,
} from './db';
import { createQuickWorkEvent } from './eventUtils';
import type {
  Person,
  CustomerMapping,
  TestProject,
  WorkEvent,
  WorkParticipant,
  WorkStatus,
  WorkType,
  WorkbenchBackup,
  WorkbenchData,
  WorkbenchModule,
} from './domain';
import {
  buildWorkloadStats,
  formatDuration,
  type CustomerMatchReason,
  type CustomerWorkloadItem,
} from './statistics';
import './workbench.css';

type WorkbenchPage = 'calendar' | 'statistics' | 'settings';
type CalendarView = 'month' | 'week' | 'day';

const EMPTY_DATA: WorkbenchData = {
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

export function WorkbenchView() {
  const [page, setPage] = useState<WorkbenchPage>('calendar');
  const [data, setData] = useState<WorkbenchData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [isDraggingImport, setDraggingImport] = useState(false);
  const [importNotice, setImportNotice] = useState<{ tone: 'success' | 'info'; text: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const next = await loadWorkbenchData();
    setData(next);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await initializeWorkbench();
        const next = await loadWorkbenchData();
        if (active) setData(next);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : '售前工作台初始化失败。');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleExport() {
    const backup = await exportWorkbenchBackup();
    downloadJson(backup, `presales-workbench-backup-${todayText()}.json`);
  }

  async function handleRestore(file: File) {
    try {
      const backup = JSON.parse(await file.text()) as WorkbenchBackup;
      if (!window.confirm('恢复会替换当前售前工作台数据。确认继续吗？')) return;
      await restoreWorkbenchBackup(backup);
      await reload();
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '恢复失败，请检查备份文件。');
    }
  }

  async function handleWorkbenchImport(file: File) {
    setImporting(true);
    setDraggingImport(false);
    setError('');
    setImportNotice(null);
    try {
      const parsed = await parseDashboardFile(file);
      const result = await captureDashboardImport({ sourceModule: 'workbench', data: parsed });
      await reload();
      if (result.duplicate) {
        setImportNotice({
          tone: 'info',
          text:
            result.newPersonCount > 0
              ? `“${result.batch.fileName}”已经导入过，客户和商机未重复写入；已从“Pipeline所有人”补充 ${result.newPersonCount} 人。`
              : `“${result.batch.fileName}”已经导入过，客户和商机未重复写入；已识别 ${result.identifiedPersonCount} 人，无需重复新增。`,
        });
      } else {
        setImportNotice({
          tone: 'success',
          text: `导入完成：新增客户 ${result.batch.newCustomerCount} 个、新增商机 ${result.batch.newOpportunityCount} 个、变化快照 ${result.batch.changedSnapshotCount} 条、未变化 ${result.batch.unchangedOpportunityCount} 条；从“Pipeline所有人”识别 ${result.identifiedPersonCount} 人，新增 ${result.newPersonCount} 人。`,
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '工作台数据导入失败。');
    } finally {
      setImporting(false);
    }
  }

  function handleImportDrag(event: DragEvent<HTMLElement>) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragleave') {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
      setDraggingImport(false);
      return;
    }
    setDraggingImport(true);
  }

  function handleImportDrop(event: DragEvent<HTMLElement>) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setDraggingImport(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleWorkbenchImport(file);
  }

  return (
    <section
      className={`workbench-module ${isDraggingImport ? 'dragging-import' : ''}`}
      onDragEnter={handleImportDrag}
      onDragOver={handleImportDrag}
      onDragLeave={handleImportDrag}
      onDrop={handleImportDrop}
    >
      <header className="workbench-hero">
        <div>
          <p className="eyebrow">Presales Work Management</p>
          <h1>售前工作台</h1>
          <p>工作记录单独保存在本机工作台数据库中，不会被销售或售前驾驶舱的清空操作影响。</p>
        </div>
        <div className="workbench-storage-status">
          <Database size={22} />
          <span>
            <strong>本地持久化已启用</strong>
            {data.events.length} 条工作 · {data.eventRevisions.length} 条历史 · {data.snapshots.length}{' '}
            条商机快照
          </span>
        </div>
      </header>

      <div className="workbench-toolbar">
        <nav className="segment" aria-label="售前工作台子栏目">
          <button className={page === 'calendar' ? 'active' : ''} onClick={() => setPage('calendar')}>
            工作日历
          </button>
          <button className={page === 'statistics' ? 'active' : ''} onClick={() => setPage('statistics')}>
            工作量统计
          </button>
          <button className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}>
            基础设置
          </button>
        </nav>
        <div className="workbench-backup-actions">
          <button
            className="button primary"
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
          >
            <FileSpreadsheet size={15} />
            {importing ? '正在导入…' : '导入客户/商机数据'}
          </button>
          <input
            ref={importInputRef}
            hidden
            type="file"
            accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.et"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleWorkbenchImport(file);
              event.target.value = '';
            }}
          />
          <button className="button ghost" onClick={() => void handleExport()}>
            <Download size={15} />
            导出备份
          </button>
          <button className="button ghost" onClick={() => restoreInputRef.current?.click()}>
            <Upload size={15} />
            恢复数据
          </button>
          <input
            ref={restoreInputRef}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleRestore(file);
              event.target.value = '';
            }}
          />
        </div>
      </div>

      {loading && <div className="workbench-message">正在读取售前工作台数据…</div>}
      {error && <div className="workbench-message danger">{error}</div>}
      {importNotice && <div className={`workbench-message ${importNotice.tone}`}>{importNotice.text}</div>}
      {isDraggingImport && (
        <div className="workbench-import-overlay">
          <Upload size={30} />
          <strong>松开鼠标，将数据导入售前工作台</strong>
          <span>不会改变销售或售前驾驶舱的当前数据</span>
        </div>
      )}
      {!loading && page === 'calendar' && <CalendarPage data={data} reload={reload} setError={setError} />}
      {!loading && page === 'statistics' && (
        <StatisticsPage data={data} reload={reload} setError={setError} />
      )}
      {!loading && page === 'settings' && <SettingsPage data={data} reload={reload} setError={setError} />}
    </section>
  );
}

function CalendarPage({
  data,
  reload,
  setError,
}: {
  data: WorkbenchData;
  reload: () => Promise<void>;
  setError: (message: string) => void;
}) {
  const [view, setView] = useState<CalendarView>('month');
  const [cursorDate, setCursorDate] = useState(todayText());
  const [personId, setPersonId] = useState('');
  const [workTypeId, setWorkTypeId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [editing, setEditing] = useState<WorkEvent | null | undefined>(undefined);
  const [quickContent, setQuickContent] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [togglingEventId, setTogglingEventId] = useState<string | null>(null);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [inlineComposerDate, setInlineComposerDate] = useState<string | null>(null);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [quickFeedback, setQuickFeedback] = useState('');
  const [calendarMotionKey, setCalendarMotionKey] = useState(0);
  const quickInputRef = useRef<HTMLTextAreaElement>(null);
  const inlineQuickInputRef = useRef<HTMLTextAreaElement>(null);

  const visibleEvents = useMemo(
    () =>
      data.events.filter((event) => {
        if (workTypeId && event.workTypeId !== workTypeId) return false;
        if (customerQuery) {
          const customer = data.customers.find((item) => item.id === event.customerId);
          const candidates = [
            event.customerNameSnapshot,
            customer?.canonicalName ?? '',
            ...(customer?.aliases ?? []),
          ];
          if (!matchesCustomerSearch(customerQuery, candidates)) return false;
        }
        if (
          personId &&
          !data.participants.some((item) => item.eventId === event.id && item.personId === personId)
        )
          return false;
        return true;
      }),
    [customerQuery, data.customers, data.events, data.participants, personId, workTypeId],
  );

  const activePeople = data.people.filter((item) => item.status === 'active');
  const selectedDayEvents = useMemo(
    () => visibleEvents.filter((event) => event.startAt.slice(0, 10) === cursorDate),
    [cursorDate, visibleEvents],
  );

  useEffect(() => {
    if (!inlineComposerDate) return;
    const frame = window.requestAnimationFrame(() => inlineQuickInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [inlineComposerDate]);

  function selectDate(date: string, openInlineComposer = true) {
    setCursorDate(date);
    if (openInlineComposer) setInlineComposerDate(date);
  }

  async function saveQuickDraft(source: 'panel' | 'calendar', date = cursorDate) {
    const content = quickContent.trim();
    if (!content) {
      (source === 'calendar' ? inlineQuickInputRef : quickInputRef).current?.focus();
      return;
    }
    setQuickSaving(true);
    try {
      const event = createQuickWorkEvent({
        id: newId(),
        content,
        date,
        timestamp: new Date().toISOString(),
      });
      await saveWorkEvent({ event, participants: [] });
      setQuickContent('');
      setCursorDate(date);
      setCreatedEventId(event.id);
      setQuickFeedback(`已添加到 ${formatSelectedDate(date)}`);
      if (source === 'calendar') setInlineComposerDate(null);
      setError('');
      await reload();
      window.setTimeout(() => {
        setCreatedEventId(null);
        setQuickFeedback('');
      }, 1800);
      if (source === 'panel') window.setTimeout(() => quickInputRef.current?.focus(), 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '快速新增工作失败。');
    } finally {
      setQuickSaving(false);
    }
  }

  async function toggleEventCompletion(event: WorkEvent) {
    if (togglingEventId) return;
    setTogglingEventId(event.id);
    const completed = event.status !== 'completed';
    try {
      await saveWorkEvent({
        event: {
          ...event,
          status: completed ? 'completed' : 'planned',
          updatedAt: new Date().toISOString(),
        },
        participants: data.participants.filter((participant) => participant.eventId === event.id),
      });
      setQuickFeedback(completed ? `已完成：${event.title}` : `已恢复：${event.title}`);
      setError('');
      await reload();
      window.setTimeout(() => setQuickFeedback(''), 1800);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '更新工作状态失败。');
    } finally {
      setTogglingEventId(null);
    }
  }

  async function moveEventToDate(event: WorkEvent, nextDate: string) {
    if (event.startAt.slice(0, 10) === nextDate) {
      setDraggingEventId(null);
      setDropTargetDate(null);
      return;
    }
    const movedEvent = moveWorkEventDate(event, nextDate);
    setDraggingEventId(event.id);
    try {
      await saveWorkEvent({
        event: movedEvent,
        participants: data.participants.filter((participant) => participant.eventId === event.id),
      });
      setCursorDate(nextDate);
      setInlineComposerDate(null);
      setCreatedEventId(event.id);
      setQuickFeedback(`已移动到 ${formatSelectedDate(nextDate)}`);
      setError('');
      await reload();
      window.setTimeout(() => {
        setCreatedEventId(null);
        setQuickFeedback('');
      }, 1800);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '调整工作日期失败。');
    } finally {
      setDraggingEventId(null);
      setDropTargetDate(null);
    }
  }

  function move(direction: -1 | 1) {
    const date = parseLocalDate(cursorDate);
    if (view === 'month') date.setMonth(date.getMonth() + direction);
    if (view === 'week') date.setDate(date.getDate() + direction * 7);
    if (view === 'day') date.setDate(date.getDate() + direction);
    setInlineComposerDate(null);
    setCalendarMotionKey((value) => value + 1);
    setCursorDate(toDateText(date));
  }

  function switchView(nextView: CalendarView) {
    setInlineComposerDate(null);
    setCalendarMotionKey((value) => value + 1);
    setView(nextView);
  }

  return (
    <div className="workbench-calendar-layout">
      <aside className="workbench-sidebar">
        <button
          className="button primary workbench-add-button"
          onClick={() => setEditing(null)}
          disabled={activePeople.length === 0}
        >
          <Plus size={16} />
          新增工作
        </button>
        {activePeople.length === 0 && <p className="workbench-help">请先在“基础设置”中新增团队人员。</p>}
        <MiniCalendar value={cursorDate} onChange={selectDate} />
        <label>
          人员筛选
          <select value={personId} onChange={(event) => setPersonId(event.target.value)}>
            <option value="">全部人员</option>
            {data.people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {person.status === 'inactive' ? '（停用）' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          工作类型
          <select value={workTypeId} onChange={(event) => setWorkTypeId(event.target.value)}>
            <option value="">全部类型</option>
            {data.workTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
                {type.status === 'inactive' ? '（停用）' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          客户搜索
          <input
            value={customerQuery}
            onChange={(event) => setCustomerQuery(event.target.value)}
            placeholder="简称或关键词模糊搜索"
          />
        </label>
        <button
          className="button ghost"
          onClick={() => {
            setPersonId('');
            setWorkTypeId('');
            setCustomerQuery('');
          }}
        >
          <RotateCcw size={14} />
          清空筛选
        </button>
      </aside>

      <section className="workbench-calendar-card">
        <div className="calendar-toolbar">
          <div className="calendar-nav-actions">
            <button
              className="button ghost"
              onClick={() => {
                setInlineComposerDate(null);
                setCalendarMotionKey((value) => value + 1);
                setCursorDate(todayText());
              }}
            >
              今天
            </button>
            <button className="icon-button" aria-label="上一页" onClick={() => move(-1)}>
              <ChevronLeft size={18} />
            </button>
            <button className="icon-button" aria-label="下一页" onClick={() => move(1)}>
              <ChevronRight size={18} />
            </button>
            <strong>{calendarTitle(cursorDate, view)}</strong>
          </div>
          <div className="segment">
            {(['month', 'week', 'day'] as CalendarView[]).map((item) => (
              <button key={item} className={view === item ? 'active' : ''} onClick={() => switchView(item)}>
                {{ month: '月', week: '周', day: '日' }[item]}
              </button>
            ))}
          </div>
        </div>
        <div className="workbench-calendar-content">
          <CalendarBody
            key={`${view}-${calendarMotionKey}`}
            view={view}
            cursorDate={cursorDate}
            events={visibleEvents}
            workTypes={data.workTypes}
            inlineComposerDate={inlineComposerDate}
            quickContent={quickContent}
            quickSaving={quickSaving}
            quickInputRef={inlineQuickInputRef}
            createdEventId={createdEventId}
            togglingEventId={togglingEventId}
            draggingEventId={draggingEventId}
            dropTargetDate={dropTargetDate}
            onSelect={selectDate}
            onQuickContentChange={setQuickContent}
            onQuickSave={(date) => void saveQuickDraft('calendar', date)}
            onCloseQuickAdd={() => {
              setInlineComposerDate(null);
              setQuickContent('');
            }}
            onEdit={setEditing}
            onToggleComplete={(event) => void toggleEventCompletion(event)}
            onDragStart={(event) => setDraggingEventId(event.id)}
            onDragEnd={() => {
              setDraggingEventId(null);
              setDropTargetDate(null);
            }}
            onDragOverDate={setDropTargetDate}
            onMoveEvent={(event, date) => void moveEventToDate(event, date)}
          />
          <DayWorkPanel
            date={cursorDate}
            events={selectedDayEvents}
            workTypes={data.workTypes}
            quickContent={quickContent}
            quickSaving={quickSaving}
            createdEventId={createdEventId}
            inputRef={quickInputRef}
            onQuickContentChange={setQuickContent}
            onQuickSave={() => void saveQuickDraft('panel')}
            onFullAdd={() => setEditing(null)}
            onEdit={setEditing}
          />
        </div>
        {quickFeedback && (
          <div className="quick-save-toast" role="status">
            <Check size={15} />
            {quickFeedback}
          </div>
        )}
      </section>

      {editing !== undefined && (
        <EventDrawer
          event={editing}
          defaultDate={cursorDate}
          data={data}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            await reload();
            setEditing(undefined);
          }}
          setError={setError}
        />
      )}
    </div>
  );
}

function CalendarBody({
  view,
  cursorDate,
  events,
  workTypes,
  inlineComposerDate,
  quickContent,
  quickSaving,
  quickInputRef,
  createdEventId,
  togglingEventId,
  draggingEventId,
  dropTargetDate,
  onSelect,
  onQuickContentChange,
  onQuickSave,
  onCloseQuickAdd,
  onEdit,
  onToggleComplete,
  onDragStart,
  onDragEnd,
  onDragOverDate,
  onMoveEvent,
}: {
  view: CalendarView;
  cursorDate: string;
  events: WorkEvent[];
  workTypes: WorkType[];
  inlineComposerDate: string | null;
  quickContent: string;
  quickSaving: boolean;
  quickInputRef: RefObject<HTMLTextAreaElement | null>;
  createdEventId: string | null;
  togglingEventId: string | null;
  draggingEventId: string | null;
  dropTargetDate: string | null;
  onSelect: (date: string, openInlineComposer?: boolean) => void;
  onQuickContentChange: (value: string) => void;
  onQuickSave: (date: string) => void;
  onCloseQuickAdd: () => void;
  onEdit: (event: WorkEvent) => void;
  onToggleComplete: (event: WorkEvent) => void;
  onDragStart: (event: WorkEvent) => void;
  onDragEnd: () => void;
  onDragOverDate: (date: string | null) => void;
  onMoveEvent: (event: WorkEvent, date: string) => void;
}) {
  const typeMap = useMemo(() => new Map(workTypes.map((item) => [item.id, item])), [workTypes]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, WorkEvent[]>();
    events.forEach((event) => {
      const date = event.startAt.slice(0, 10);
      const existing = grouped.get(date);
      if (existing) existing.push(event);
      else grouped.set(date, [event]);
    });
    return grouped;
  }, [events]);

  if (view === 'month') {
    const dates = monthGridDates(cursorDate);
    const cursorMonth = parseLocalDate(cursorDate).getMonth();
    return (
      <div className="month-calendar">
        {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
          <div className="calendar-weekday" key={day}>
            周{day}
          </div>
        ))}
        {dates.map((date, index) => {
          const dateText = toDateText(date);
          const dayEvents = eventsByDate.get(dateText) ?? [];
          const isComposing = inlineComposerDate === dateText;
          const isDropTarget = draggingEventId !== null && dropTargetDate === dateText;
          return (
            <div
              key={dateText}
              className={`calendar-day ${date.getMonth() !== cursorMonth ? 'outside' : ''} ${dateText === todayText() ? 'today' : ''} ${dateText === cursorDate ? 'selected' : ''} ${isComposing ? 'composing' : ''} ${isDropTarget ? 'drag-over' : ''}`}
              onDragEnter={(dragEvent) => {
                if (!draggingEventId) return;
                dragEvent.preventDefault();
                onDragOverDate(dateText);
              }}
              onDragOver={(dragEvent) => {
                if (!draggingEventId) return;
                dragEvent.preventDefault();
                dragEvent.dataTransfer.dropEffect = 'move';
                if (dropTargetDate !== dateText) onDragOverDate(dateText);
              }}
              onDragLeave={(dragEvent) => {
                if (dragEvent.currentTarget.contains(dragEvent.relatedTarget as Node | null)) return;
                if (dropTargetDate === dateText) onDragOverDate(null);
              }}
              onDrop={(dragEvent) => {
                if (!draggingEventId) return;
                dragEvent.preventDefault();
                const draggedEvent = events.find((item) => item.id === draggingEventId);
                if (draggedEvent) onMoveEvent(draggedEvent, dateText);
              }}
            >
              <button
                className="calendar-cell-select"
                aria-label={`选择 ${dateText}`}
                title="双击可快速新增工作"
                onClick={() => onSelect(dateText, false)}
                onDoubleClick={() => onSelect(dateText, true)}
              >
                <span>{date.getDate()}</span>
              </button>
              {isComposing && (
                <InlineQuickComposer
                  date={dateText}
                  content={quickContent}
                  saving={quickSaving}
                  inputRef={quickInputRef}
                  placement={`${index % 7 >= 5 ? 'align-right' : ''} ${index >= 35 ? 'align-up' : ''}`}
                  onContentChange={onQuickContentChange}
                  onSave={() => onQuickSave(dateText)}
                  onClose={onCloseQuickAdd}
                />
              )}
              <div
                className="calendar-day-events"
                aria-label={`${dateText} 工作列表`}
                onClick={(event) => {
                  if (event.target === event.currentTarget) onSelect(dateText, false);
                }}
                onDoubleClick={(event) => {
                  if (event.target === event.currentTarget) onSelect(dateText, true);
                }}
              >
                {dayEvents.map((event) => (
                  <EventPill
                    key={event.id}
                    event={event}
                    type={event.workTypeId ? typeMap.get(event.workTypeId) : undefined}
                    isNew={event.id === createdEventId}
                    toggling={event.id === togglingEventId}
                    dragging={event.id === draggingEventId}
                    onClick={() => onEdit(event)}
                    onToggleComplete={() => onToggleComplete(event)}
                    onDragStart={() => onDragStart(event)}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const dates = view === 'week' ? weekDates(cursorDate) : [parseLocalDate(cursorDate)];
  return (
    <div className={`agenda-calendar ${view}`}>
      {dates.map((date) => {
        const dateText = toDateText(date);
        const dayEvents = eventsByDate.get(dateText) ?? [];
        const isComposing = inlineComposerDate === dateText;
        return (
          <section key={dateText} className={`agenda-day ${isComposing ? 'composing' : ''}`}>
            <button
              className={`agenda-date ${dateText === cursorDate ? 'selected' : ''}`}
              title="双击可快速新增工作"
              onClick={() => onSelect(dateText, false)}
              onDoubleClick={() => onSelect(dateText, true)}
            >
              <span>{['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}</span>
              <strong>{date.getDate()}</strong>
            </button>
            <div className="agenda-events">
              {isComposing && (
                <InlineQuickComposer
                  date={dateText}
                  content={quickContent}
                  saving={quickSaving}
                  inputRef={quickInputRef}
                  inline
                  onContentChange={onQuickContentChange}
                  onSave={() => onQuickSave(dateText)}
                  onClose={onCloseQuickAdd}
                />
              )}
              {dayEvents.length === 0 && (
                <button
                  className="agenda-empty"
                  onClick={() => onSelect(dateText, true)}
                  hidden={isComposing}
                >
                  点击新增工作
                </button>
              )}
              {dayEvents.map((event) => (
                <EventPill
                  key={event.id}
                  event={event}
                  type={event.workTypeId ? typeMap.get(event.workTypeId) : undefined}
                  isNew={event.id === createdEventId}
                  toggling={event.id === togglingEventId}
                  dragging={event.id === draggingEventId}
                  onClick={() => onEdit(event)}
                  onToggleComplete={() => onToggleComplete(event)}
                  onDragStart={() => onDragStart(event)}
                  onDragEnd={onDragEnd}
                  expanded
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function InlineQuickComposer({
  date,
  content,
  saving,
  inputRef,
  placement = '',
  inline = false,
  onContentChange,
  onSave,
  onClose,
}: {
  date: string;
  content: string;
  saving: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  placement?: string;
  inline?: boolean;
  onContentChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <form
      className={`calendar-inline-composer ${placement} ${inline ? 'inline' : ''}`}
      aria-label={`快速新增 ${date}`}
      onClick={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && content.trim() && !saving) {
          event.preventDefault();
          onSave();
        }
      }}
    >
      <header>
        <span>{formatSelectedDate(date)}</span>
        <button type="button" aria-label="关闭快速新增" onClick={onClose}>
          <X size={14} />
        </button>
      </header>
      <textarea
        ref={inputRef}
        value={content}
        maxLength={1000}
        rows={4}
        placeholder="直接填写具体工作内容，首行作为标题"
        onChange={(event) => onContentChange(event.target.value)}
      />
      <footer>
        <span>Ctrl + Enter 保存计划草稿</span>
        <button type="submit" disabled={saving || !content.trim()}>
          {saving ? '保存中…' : '添加'}
        </button>
      </footer>
    </form>
  );
}

function DayWorkPanel({
  date,
  events,
  workTypes,
  quickContent,
  quickSaving,
  createdEventId,
  inputRef,
  onQuickContentChange,
  onQuickSave,
  onFullAdd,
  onEdit,
}: {
  date: string;
  events: WorkEvent[];
  workTypes: WorkType[];
  quickContent: string;
  quickSaving: boolean;
  createdEventId: string | null;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onQuickContentChange: (value: string) => void;
  onQuickSave: () => void;
  onFullAdd: () => void;
  onEdit: (event: WorkEvent) => void;
}) {
  const typeMap = new Map(workTypes.map((item) => [item.id, item]));
  const sortedEvents = [...events].sort((a, b) => a.startAt.localeCompare(b.startAt));
  return (
    <aside className="day-work-panel">
      <header>
        <div>
          <p className="eyebrow">Selected Day</p>
          <h2>{formatSelectedDate(date)}</h2>
        </div>
        <span>{events.length} 项工作</span>
      </header>
      <form
        className="quick-work-add"
        onSubmit={(event) => {
          event.preventDefault();
          onQuickSave();
        }}
      >
        <textarea
          ref={inputRef}
          value={quickContent}
          maxLength={1000}
          rows={3}
          onChange={(event) => onQuickContentChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && quickContent.trim()) {
              event.preventDefault();
              onQuickSave();
            }
          }}
          placeholder={`直接填写 ${formatSelectedDate(date)} 的具体工作内容`}
        />
        <button className="button primary" type="submit" disabled={quickSaving || !quickContent.trim()}>
          <Plus size={15} />
          {quickSaving ? '保存中…' : '新建'}
        </button>
      </form>
      <p className="quick-work-hint">首行自动作为标题；Ctrl + Enter 可保存计划草稿，不进入完成量统计。</p>
      <button className="button ghost day-full-add" onClick={onFullAdd}>
        完整录入工作
      </button>
      <div className="day-work-list">
        {sortedEvents.map((event) => {
          const type = event.workTypeId ? typeMap.get(event.workTypeId) : undefined;
          const isDraft = event.entryMode === 'quick' || event.allDay || !event.ownerId || !event.workTypeId;
          return (
            <button
              key={event.id}
              className={`day-work-item ${event.status} ${event.id === createdEventId ? 'just-created' : ''}`}
              onClick={() => onEdit(event)}
            >
              <i style={{ background: type?.color ?? '#94a3b8' }} />
              <span>
                <strong>{event.title}</strong>
                <small>
                  {event.allDay ? '全天' : event.startAt.slice(11, 16)}
                  {type ? ` · ${type.name}` : ''}
                </small>
              </span>
              {!isDraft && <em>{workStatusLabel(event.status)}</em>}
            </button>
          );
        })}
        {sortedEvents.length === 0 && <p className="empty-analysis">这一天还没有工作记录。</p>}
      </div>
    </aside>
  );
}

function EventPill({
  event,
  type,
  onClick,
  onToggleComplete,
  onDragStart,
  onDragEnd,
  expanded = false,
  isNew = false,
  toggling = false,
  dragging = false,
}: {
  event: WorkEvent;
  type?: WorkType;
  onClick: () => void;
  onToggleComplete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  expanded?: boolean;
  isNew?: boolean;
  toggling?: boolean;
  dragging?: boolean;
}) {
  const completed = event.status === 'completed';
  return (
    <div
      className={`work-event-pill ${event.status} ${expanded ? 'expanded' : ''} ${isNew ? 'just-created' : ''} ${dragging ? 'dragging' : ''}`}
      style={{ borderLeftColor: type?.color ?? '#94a3b8' }}
      draggable
      title="拖到其他日期可调整时间"
      onDragStart={(dragEvent) => {
        dragEvent.dataTransfer.effectAllowed = 'move';
        dragEvent.dataTransfer.setData('text/plain', event.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <button className="work-event-main" type="button" onClick={onClick}>
        <span>{event.allDay ? '全天' : event.startAt.slice(11, 16)}</span>
        <strong title={event.title}>{event.title}</strong>
      </button>
      <button
        className="work-event-complete"
        type="button"
        draggable={false}
        aria-label={completed ? `取消勾选“${event.title}”` : `勾选“${event.title}”为已完成`}
        aria-pressed={completed}
        title={completed ? '点击恢复为未完成' : '点击勾选为已完成'}
        disabled={toggling}
        onPointerDown={(clickEvent) => clickEvent.stopPropagation()}
        onMouseDown={(clickEvent) => clickEvent.stopPropagation()}
        onDragStart={(dragEvent) => {
          dragEvent.preventDefault();
          dragEvent.stopPropagation();
        }}
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          onToggleComplete();
        }}
      >
        {completed && <Check size={11} strokeWidth={3} />}
      </button>
    </div>
  );
}

interface EventDraft {
  title: string;
  date: string;
  entryMode: 'quick' | 'detailed';
  allDay: boolean;
  startTime: string;
  endTime: string;
  status: WorkStatus;
  workTypeId: string;
  ownerId: string;
  selectedParticipantIds: string[];
  participantHours: Record<string, string>;
  customerId: string;
  temporaryCustomerName: string;
  opportunityId: string;
  workMode: string;
  location: string;
  content: string;
  result: string;
  nextAction: string;
  testProjectId: string;
  newTestProjectName: string;
}

interface FuzzyOption {
  value: string;
  label: string;
  detail?: string;
  keywords?: string[];
}

function EventDrawer({
  event,
  defaultDate,
  data,
  onClose,
  onSaved,
  setError,
}: {
  event: WorkEvent | null;
  defaultDate: string;
  data: WorkbenchData;
  onClose: () => void;
  onSaved: () => Promise<void>;
  setError: (message: string) => void;
}) {
  const existingParticipants = event ? data.participants.filter((item) => item.eventId === event.id) : [];
  const [draft, setDraft] = useState<EventDraft>(() =>
    eventToDraft(event, existingParticipants, data, defaultDate),
  );
  const [saving, setSaving] = useState(false);
  const selectedType = data.workTypes.find((item) => item.id === draft.workTypeId);
  const isTestWork = selectedType?.code === 'test_poc';
  const availablePeople = data.people.filter(
    (person) => person.status === 'active' || draft.selectedParticipantIds.includes(person.id),
  );
  const opportunities = data.opportunities.filter((item) => item.customerId === draft.customerId);
  const customerOptions = useMemo<FuzzyOption[]>(
    () => [
      { value: '', label: '暂不关联', keywords: ['暂不关联', '不关联'] },
      ...data.customers.map((customer) => ({
        value: customer.id,
        label: customer.canonicalName,
        detail: customer.matchStatus === 'pending' ? '待匹配' : undefined,
        keywords: [customer.canonicalName, ...customer.aliases],
      })),
      {
        value: '__temporary__',
        label: '＋ 临时录入新客户',
        keywords: ['临时录入新客户', '新客户', '临时客户'],
      },
    ],
    [data.customers],
  );
  const opportunityOptions = useMemo<FuzzyOption[]>(
    () => [
      { value: '', label: '暂不关联', keywords: ['暂不关联', '不关联'] },
      ...opportunities.map((opportunity) => ({
        value: opportunity.id,
        label: opportunity.canonicalName,
        keywords: [opportunity.canonicalName, ...opportunity.aliases],
      })),
    ],
    [opportunities],
  );

  function patchDraft(patch: Partial<EventDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function chooseOwner(ownerId: string) {
    const selectedParticipantIds = draft.selectedParticipantIds.includes(ownerId)
      ? draft.selectedParticipantIds
      : [...draft.selectedParticipantIds, ownerId].filter(Boolean);
    patchDraft({ ownerId, selectedParticipantIds });
  }

  function toggleParticipant(personId: string) {
    if (personId === draft.ownerId) return;
    const selectedParticipantIds = draft.selectedParticipantIds.includes(personId)
      ? draft.selectedParticipantIds.filter((id) => id !== personId)
      : [...draft.selectedParticipantIds, personId];
    patchDraft({ selectedParticipantIds });
  }

  async function handleSave() {
    const validation = validateDraft(draft, isTestWork);
    if (validation) {
      setError(validation);
      return;
    }
    const totalMinutes = draft.selectedParticipantIds.reduce(
      (total, personId) =>
        total + Math.round(Math.max(0, Number(draft.participantHours[personId] || 0)) * 60),
      0,
    );
    if (
      draft.status === 'completed' &&
      draft.selectedParticipantIds.length > 0 &&
      totalMinutes === 0 &&
      !window.confirm('该已完成工作所有人员投入时长均为 0，仍要保存吗？')
    )
      return;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      let customerId = draft.customerId;
      let customerNameSnapshot = data.customers.find((item) => item.id === customerId)?.canonicalName ?? '';
      if (customerId === '__temporary__') {
        const matchedCustomer = findUniqueCustomerMatch(draft.temporaryCustomerName, data.customers);
        if (matchedCustomer) {
          customerId = matchedCustomer.id;
          customerNameSnapshot = matchedCustomer.canonicalName;
        } else {
          const temporary = await createTemporaryCustomer(draft.temporaryCustomerName);
          customerId = temporary.id;
          customerNameSnapshot = temporary.canonicalName;
        }
      }
      const opportunity = data.opportunities.find((item) => item.id === draft.opportunityId);
      let testProjectId = draft.testProjectId;
      if (isTestWork && testProjectId === '__new__') {
        const project: TestProject = {
          id: newId(),
          name: draft.newTestProjectName.trim(),
          customerId: customerId || undefined,
          opportunityId: opportunity?.id,
          product: '',
          ownerId: draft.ownerId,
          participantIds: [...new Set(draft.selectedParticipantIds)],
          startDate: draft.date,
          endDate: draft.date,
          status: 'in_progress',
          outcome: 'pending',
          summary: '',
          createdAt: now,
          updatedAt: now,
        };
        await saveTestProject(project);
        testProjectId = project.id;
      }

      const startAt = draft.allDay ? `${draft.date}T00:00:00` : `${draft.date}T${draft.startTime}:00`;
      const endAt = draft.allDay ? `${draft.date}T23:59:59` : `${draft.date}T${draft.endTime}:00`;
      const eventId = event?.id ?? newId();
      const nextEvent: WorkEvent = {
        id: eventId,
        title: draft.title.trim(),
        status: draft.status,
        entryMode: draft.ownerId && draft.workTypeId && !draft.allDay ? 'detailed' : 'quick',
        allDay: draft.allDay,
        startAt,
        endAt,
        workTypeId: draft.workTypeId || undefined,
        ownerId: draft.ownerId || undefined,
        customerId: customerId || undefined,
        customerNameSnapshot,
        opportunityId: opportunity?.id,
        opportunityNameSnapshot: opportunity?.canonicalName ?? '',
        workMode: draft.workMode,
        location: draft.location.trim(),
        content: draft.content.trim(),
        result: draft.result.trim(),
        nextAction: draft.nextAction.trim(),
        testProjectId: testProjectId && testProjectId !== '__new__' ? testProjectId : undefined,
        createdAt: event?.createdAt ?? now,
        updatedAt: now,
      };
      const participants: WorkParticipant[] = [...new Set(draft.selectedParticipantIds)].map((personId) => ({
        id: `${eventId}:${personId}`,
        eventId,
        personId,
        actualMinutes: Math.round(Math.max(0, Number(draft.participantHours[personId] || 0)) * 60),
      }));
      await saveWorkEvent({ event: nextEvent, participants });
      setError('');
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '工作记录保存失败。');
    } finally {
      setSaving(false);
    }
  }

  async function cancelEvent() {
    if (!event || !window.confirm('确认取消这条工作记录吗？取消后不进入完成量统计。')) return;
    setSaving(true);
    try {
      await saveWorkEvent({
        event: { ...event, status: 'cancelled', updatedAt: new Date().toISOString() },
        participants: existingParticipants,
      });
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '取消工作失败。');
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent() {
    if (
      !event ||
      !window.confirm(`确认永久删除“${event.title}”吗？删除后无法恢复，相关人员投入和历史版本也会一并删除。`)
    )
      return;
    setSaving(true);
    try {
      await deleteWorkEvent(event.id);
      setError('');
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除工作失败。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="drawer-backdrop" aria-label="关闭编辑抽屉" onClick={onClose} />
      <aside className="drawer workbench-drawer" aria-label={event ? '编辑工作' : '新增工作'}>
        <button className="drawer-close" aria-label="关闭" onClick={onClose}>
          <X size={20} />
        </button>
        <p className="eyebrow">{event ? 'Edit Work' : 'New Work'}</p>
        <h2>{event ? '编辑工作记录' : '新增工作记录'}</h2>
        {(event?.entryMode === 'quick' || draft.allDay || !draft.ownerId || !draft.workTypeId) && (
          <div className="draft-completion-note">
            信息未补齐时仍可保存为已完成；统计只按已填写的人员、类型和投入时长计算。
          </div>
        )}
        <div className="workbench-form">
          <label className="form-span-2">
            标题
            <input
              value={draft.title}
              onChange={(e) => patchDraft({ title: e.target.value })}
              placeholder="例如：某客户方案交流"
            />
          </label>
          <label>
            日期
            <input type="date" value={draft.date} onChange={(e) => patchDraft({ date: e.target.value })} />
          </label>
          <label>
            状态
            <select
              value={draft.status}
              onChange={(e) => patchDraft({ status: e.target.value as WorkStatus })}
            >
              <option value="planned">计划中</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </label>
          <label className="form-span-2 schedule-mode-label">
            <input
              type="checkbox"
              checked={draft.allDay}
              onChange={(e) => patchDraft({ allDay: e.target.checked })}
            />
            全天或暂未安排具体时间
          </label>
          <label>
            开始时间
            <input
              type="time"
              disabled={draft.allDay}
              value={draft.startTime}
              onChange={(e) => patchDraft({ startTime: e.target.value })}
            />
          </label>
          <label>
            结束时间
            <input
              type="time"
              disabled={draft.allDay}
              value={draft.endTime}
              onChange={(e) => patchDraft({ endTime: e.target.value })}
            />
          </label>
          <label>
            工作类型
            <select
              value={draft.workTypeId}
              onChange={(e) => patchDraft({ workTypeId: e.target.value, testProjectId: '' })}
            >
              <option value="">请选择</option>
              {data.workTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                  {type.status === 'inactive' ? '（停用）' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            负责人
            <select value={draft.ownerId} onChange={(e) => chooseOwner(e.target.value)}>
              <option value="">请选择</option>
              {availablePeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                  {person.status === 'inactive' ? '（停用）' : ''}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="form-span-2 participant-fieldset">
            <legend>参与人员与实际投入</legend>
            {availablePeople.map((person) => {
              const checked = draft.selectedParticipantIds.includes(person.id);
              return (
                <div className="participant-row" key={person.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={person.id === draft.ownerId}
                      onChange={() => toggleParticipant(person.id)}
                    />
                    {person.name}
                  </label>
                  <label>
                    投入
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      disabled={!checked}
                      value={draft.participantHours[person.id] ?? ''}
                      onChange={(e) =>
                        patchDraft({
                          participantHours: { ...draft.participantHours, [person.id]: e.target.value },
                        })
                      }
                    />
                    <span>小时</span>
                  </label>
                </div>
              );
            })}
          </fieldset>

          <FuzzySelect
            label="客户"
            value={draft.customerId}
            options={customerOptions}
            placeholder="输入客户简称或全称搜索"
            emptyText="没有匹配客户"
            onChange={(value) => patchDraft({ customerId: value, opportunityId: '' })}
          />
          {draft.customerId === '__temporary__' ? (
            <label>
              新客户名称
              <input
                value={draft.temporaryCustomerName}
                onChange={(e) => patchDraft({ temporaryCustomerName: e.target.value })}
                placeholder="将标记为待匹配"
              />
            </label>
          ) : (
            <FuzzySelect
              label="关联商机"
              value={draft.opportunityId}
              options={opportunityOptions}
              placeholder={draft.customerId ? '输入商机名称搜索' : '先选择客户后搜索商机'}
              emptyText={draft.customerId ? '没有匹配商机' : '请先选择客户'}
              onChange={(value) => patchDraft({ opportunityId: value })}
            />
          )}

          {isTestWork && (
            <>
              <label>
                测试项目
                <select
                  value={draft.testProjectId}
                  onChange={(e) => patchDraft({ testProjectId: e.target.value })}
                >
                  <option value="">请选择</option>
                  {data.testProjects
                    .filter((project) => project.status !== 'cancelled')
                    .map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  <option value="__new__">＋ 新建测试项目</option>
                </select>
              </label>
              {draft.testProjectId === '__new__' && (
                <label>
                  项目名称
                  <input
                    value={draft.newTestProjectName}
                    onChange={(e) => patchDraft({ newTestProjectName: e.target.value })}
                  />
                </label>
              )}
            </>
          )}

          <label>
            工作方式
            <select value={draft.workMode} onChange={(e) => patchDraft({ workMode: e.target.value })}>
              <option value="现场">现场</option>
              <option value="远程">远程</option>
              <option value="公司内部">公司内部</option>
              <option value="其他">其他</option>
            </select>
          </label>
          <label>
            地点
            <input value={draft.location} onChange={(e) => patchDraft({ location: e.target.value })} />
          </label>
          <label className="form-span-2">
            工作内容
            <textarea value={draft.content} onChange={(e) => patchDraft({ content: e.target.value })} />
          </label>
          <label className="form-span-2">
            工作结果
            <textarea value={draft.result} onChange={(e) => patchDraft({ result: e.target.value })} />
          </label>
          <label className="form-span-2">
            下一步行动
            <textarea value={draft.nextAction} onChange={(e) => patchDraft({ nextAction: e.target.value })} />
          </label>
        </div>
        <div className="drawer-actions">
          {event && (
            <div className="drawer-destructive-actions">
              <button className="button danger" disabled={saving} onClick={() => void removeEvent()}>
                <Trash2 size={15} />
                删除记录
              </button>
              {event.status !== 'cancelled' && (
                <button className="button ghost" disabled={saving} onClick={() => void cancelEvent()}>
                  取消工作
                </button>
              )}
            </div>
          )}
          <button className="button ghost" onClick={onClose}>
            关闭
          </button>
          <button className="button primary" disabled={saving} onClick={() => void handleSave()}>
            {saving ? '保存中…' : '保存记录'}
          </button>
        </div>
      </aside>
    </>
  );
}

function FuzzySelect({
  label,
  value,
  options,
  placeholder,
  emptyText,
  onChange,
}: {
  label: string;
  value: string;
  options: FuzzyOption[];
  placeholder: string;
  emptyText: string;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLLabelElement | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const visibleOptions = useMemo(() => {
    if (!query.trim()) return options.slice(0, 8);
    return options.filter((option) => fuzzyOptionMatches(option, query)).slice(0, 8);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <label ref={rootRef} className="fuzzy-select-field">
      {label}
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={`${label}-fuzzy-options`}
        value={open ? query : (selected?.label ?? '')}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            setQuery('');
          }
          if (event.key === 'Enter' && open && visibleOptions[0]) {
            event.preventDefault();
            onChange(visibleOptions[0].value);
            setOpen(false);
            setQuery('');
          }
        }}
        placeholder={placeholder}
      />
      {open && (
        <div className="fuzzy-select-menu" id={`${label}-fuzzy-options`}>
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option) => (
              <button
                key={option.value || '__empty__'}
                type="button"
                className={option.value === value ? 'selected' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <span>{option.label}</span>
                {option.detail && <em>{option.detail}</em>}
              </button>
            ))
          ) : (
            <p>{emptyText}</p>
          )}
        </div>
      )}
    </label>
  );
}

function fuzzyOptionMatches(option: FuzzyOption, query: string) {
  const normalizedQuery = normalizeBusinessName(query);
  if (!normalizedQuery) return true;
  return [option.label, ...(option.keywords ?? [])].some((keyword) => {
    const normalizedKeyword = normalizeBusinessName(keyword);
    return normalizedKeyword.includes(normalizedQuery) || isSubsequence(normalizedQuery, normalizedKeyword);
  });
}

function findUniqueCustomerMatch(name: string, customers: CustomerMapping[]) {
  const normalizedName = normalizeBusinessName(name);
  if (!normalizedName) return undefined;
  const matches = customers.filter((customer) =>
    matchesCustomerSearch(name, [customer.canonicalName, ...customer.aliases]),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function isSubsequence(query: string, target: string) {
  let cursor = 0;
  for (const char of target) {
    if (char === query[cursor]) cursor += 1;
    if (cursor === query.length) return true;
  }
  return false;
}

function StatisticsPage({
  data,
  reload,
  setError,
}: {
  data: WorkbenchData;
  reload: () => Promise<void>;
  setError: (message: string) => void;
}) {
  const [personId, setPersonId] = useState('');
  const [workTypeId, setWorkTypeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<WorkEvent | undefined>(undefined);
  const stats = useMemo(
    () =>
      buildWorkloadStats(
        data.events,
        data.participants,
        data.people,
        data.workTypes,
        data.customers,
        data.opportunities,
        {
          personId,
          workTypeId,
          from,
          to,
        },
      ),
    [data, from, personId, to, workTypeId],
  );
  const selectedCustomer = stats.customers.find((item) => item.key === selectedCustomerKey);
  const maxPersonMinutes = Math.max(1, ...stats.people.map((item) => item.minutes));
  const maxTypeMinutes = Math.max(1, ...stats.types.map((item) => item.minutes));
  const maxCustomerMinutes = Math.max(1, ...stats.customers.map((item) => item.minutes));
  return (
    <div className="workbench-statistics">
      <section className="workbench-filter-card">
        <label>
          开始日期
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          结束日期
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          人员
          <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">全部人员</option>
            {data.people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          工作类型
          <select value={workTypeId} onChange={(e) => setWorkTypeId(e.target.value)}>
            <option value="">全部类型</option>
            {data.workTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="workbench-kpi-grid">
        <StatCard label="已完成团队工作" value={`${stats.teamEventCount} 次`} hint="按事件编号去重" />
        <StatCard label="个人参与次数" value={`${stats.personalEventCount} 次`} hint="每位参与人分别计次" />
        <StatCard label="总投入时长" value={formatDuration(stats.totalMinutes)} hint="按人员实际投入求和" />
        <StatCard
          label="覆盖商机客户"
          value={`${stats.customerCount} 个`}
          hint={`其他客户 ${stats.otherCustomerCount} 个 · 未关联工作 ${stats.unlinkedEventCount} 条`}
        />
        <StatCard label="客户拜访" value={`${stats.visitCount} 次`} hint="仅已完成客户拜访" />
      </section>
      <div className="workbench-analysis-grid">
        <section className="workbench-panel">
          <h2>人员工作量排名</h2>
          {stats.people.length === 0 ? (
            <EmptyAnalysis />
          ) : (
            stats.people.map((item) => (
              <BarRow
                key={item.id}
                label={item.name}
                value={item.minutes}
                max={maxPersonMinutes}
                detail={`${item.eventCount} 次 · ${formatDuration(item.minutes)}`}
              />
            ))
          )}
        </section>
        <section className="workbench-panel">
          <h2>工作类型分布</h2>
          {stats.types.length === 0 ? (
            <EmptyAnalysis />
          ) : (
            stats.types.map((item) => (
              <BarRow
                key={item.id}
                label={item.name}
                value={item.minutes}
                max={maxTypeMinutes}
                detail={`${item.eventCount} 次 · ${formatDuration(item.minutes)}`}
                color={item.color}
              />
            ))
          )}
        </section>
      </div>
      <section className="workbench-panel customer-workload-panel">
        <div className="customer-workload-title">
          <div>
            <h2>客户工作量分布</h2>
            <p>自动关联曾导入且拥有商机的客户；点击任一项查看工作明细。</p>
          </div>
        </div>
        {stats.customers.length === 0 ? (
          <EmptyAnalysis />
        ) : (
          stats.customers.map((item) => (
            <BarRow
              key={item.key}
              label={item.name}
              value={item.minutes}
              max={maxCustomerMinutes}
              detail={`${item.eventCount} 次 · ${formatDuration(item.minutes)}`}
              color={customerWorkloadColor(item.category)}
              onClick={() => setSelectedCustomerKey(item.key)}
            />
          ))
        )}
      </section>
      {selectedCustomer && !editing && (
        <CustomerWorkloadDrawer
          item={selectedCustomer}
          data={data}
          customerMatches={stats.customerMatches}
          onClose={() => setSelectedCustomerKey(null)}
          onOpenEvent={(event) => setEditing(event)}
        />
      )}
      {editing && (
        <EventDrawer
          event={editing}
          defaultDate={editing.startAt.slice(0, 10)}
          data={data}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            await reload();
            setEditing(undefined);
          }}
          setError={setError}
        />
      )}
    </div>
  );
}

function CustomerWorkloadDrawer({
  item,
  data,
  customerMatches,
  onClose,
  onOpenEvent,
}: {
  item: CustomerWorkloadItem;
  data: WorkbenchData;
  customerMatches: ReturnType<typeof buildWorkloadStats>['customerMatches'];
  onClose: () => void;
  onOpenEvent: (event: WorkEvent) => void;
}) {
  const events = item.eventIds
    .map((eventId) => data.events.find((event) => event.id === eventId))
    .filter((event): event is WorkEvent => Boolean(event))
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
  const peopleById = new Map(data.people.map((person) => [person.id, person]));
  const typesById = new Map(data.workTypes.map((type) => [type.id, type]));
  const customersById = new Map(data.customers.map((customer) => [customer.id, customer]));
  const opportunitiesById = new Map(data.opportunities.map((opportunity) => [opportunity.id, opportunity]));

  return (
    <>
      <button className="drawer-backdrop" aria-label="关闭客户工作明细" onClick={onClose} />
      <aside className="drawer workbench-drawer customer-workload-drawer" aria-label={`${item.name}工作明细`}>
        <button className="drawer-close" aria-label="关闭" onClick={onClose}>
          <X size={20} />
        </button>
        <p className="eyebrow">Customer Workload</p>
        <h2>{item.name}</h2>
        <p className="customer-workload-summary">
          {item.eventCount} 次工作 · {formatDuration(item.minutes)}
        </p>
        <div className="customer-detail-header" aria-hidden="true">
          <span>工作</span>
          <span>人员与投入</span>
          <span>客户与商机</span>
          <span>归类依据</span>
        </div>
        <div className="customer-detail-list">
          {events.map((event) => {
            const participants = data.participants.filter((participant) => participant.eventId === event.id);
            const participantText =
              participants
                .map((participant) => {
                  const person = peopleById.get(participant.personId);
                  return `${person?.name ?? '已停用人员'} ${formatDuration(participant.actualMinutes)}`;
                })
                .join('、') || '未填写人员与投入';
            const linkedCustomer = event.customerId ? customersById.get(event.customerId) : undefined;
            const opportunity = event.opportunityId ? opportunitiesById.get(event.opportunityId) : undefined;
            const match = customerMatches[event.id];
            const originalCustomer =
              event.customerNameSnapshot || linkedCustomer?.canonicalName || '未填写客户';
            return (
              <button
                key={event.id}
                type="button"
                className="customer-detail-row"
                aria-label={`打开工作详情：${event.title}`}
                onClick={() => onOpenEvent(event)}
              >
                <span>
                  <strong>{event.title}</strong>
                  <small>
                    {event.startAt.slice(0, 10)} ·{' '}
                    {event.workTypeId
                      ? (typesById.get(event.workTypeId)?.name ?? '已停用类型')
                      : '未填写类型'}
                  </small>
                </span>
                <span>{participantText}</span>
                <span>
                  <strong>{originalCustomer}</strong>
                  <small>
                    {(opportunity?.canonicalName ?? event.opportunityNameSnapshot) || '未关联商机'}
                  </small>
                </span>
                <span>
                  <em className={`customer-match-badge ${match?.reason ?? 'missing'}`}>
                    {customerMatchReasonLabel(match?.reason ?? 'missing')}
                  </em>
                  {match?.reason === 'ambiguous' && (
                    <small>{formatCandidateCustomers(match.candidateCustomerIds, customersById)}</small>
                  )}
                </span>
                <ChevronRight size={17} />
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}

function customerWorkloadColor(category: CustomerWorkloadItem['category']) {
  if (category === 'other') return '#64748b';
  if (category === 'unlinked') return '#94a3b8';
  return '#2563eb';
}

function customerMatchReasonLabel(reason: CustomerMatchReason) {
  const labels: Record<CustomerMatchReason, string> = {
    opportunity: '关联商机',
    customer: '已关联商机客户',
    fuzzy: '名称唯一模糊命中',
    unmatched: '未命中商机客户',
    ambiguous: '存在多个候选客户',
    missing: '工作未填写客户',
  };
  return labels[reason];
}

function formatCandidateCustomers(customerIds: string[], customersById: Map<string, CustomerMapping>) {
  const names = customerIds
    .map((customerId) => customersById.get(customerId)?.canonicalName)
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? `候选：${names.join('、')}` : '';
}

function SettingsPage({
  data,
  reload,
  setError,
}: {
  data: WorkbenchData;
  reload: () => Promise<void>;
  setError: (message: string) => void;
}) {
  const [personName, setPersonName] = useState('');
  const [typeName, setTypeName] = useState('');
  const [typeColor, setTypeColor] = useState('#2563eb');

  async function addPerson() {
    const name = personName.trim();
    if (!name) return;
    if (data.people.some((item) => item.normalizedName === normalizeBusinessName(name))) {
      setError('人员姓名已存在，不能重复新增。');
      return;
    }
    const now = new Date().toISOString();
    await savePerson({
      id: newId(),
      name,
      normalizedName: normalizeBusinessName(name),
      status: 'active',
      sortOrder: (data.people.at(-1)?.sortOrder ?? 0) + 10,
      createdAt: now,
      updatedAt: now,
    });
    setPersonName('');
    setError('');
    await reload();
  }

  async function togglePerson(person: Person) {
    await savePerson({
      ...person,
      status: person.status === 'active' ? 'inactive' : 'active',
      updatedAt: new Date().toISOString(),
    });
    await reload();
  }

  async function addType() {
    const name = typeName.trim();
    if (!name) return;
    if (data.workTypes.some((item) => normalizeBusinessName(item.name) === normalizeBusinessName(name))) {
      setError('工作类型名称已存在。');
      return;
    }
    const now = new Date().toISOString();
    await saveWorkType({
      id: newId(),
      code: `custom_${newId()}`,
      name,
      color: typeColor,
      status: 'active',
      sortOrder: (data.workTypes.at(-1)?.sortOrder ?? 0) + 10,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
    setTypeName('');
    setError('');
    await reload();
  }

  async function toggleType(type: WorkType) {
    await saveWorkType({
      ...type,
      status: type.status === 'active' ? 'inactive' : 'active',
      updatedAt: new Date().toISOString(),
    });
    await reload();
  }

  async function moveType(type: WorkType, direction: -1 | 1) {
    const index = data.workTypes.findIndex((item) => item.id === type.id);
    const target = data.workTypes[index + direction];
    if (!target) return;
    const now = new Date().toISOString();
    await Promise.all([
      saveWorkType({ ...type, sortOrder: target.sortOrder, updatedAt: now }),
      saveWorkType({ ...target, sortOrder: type.sortOrder, updatedAt: now }),
    ]);
    await reload();
  }

  return (
    <div className="workbench-settings-grid">
      <section className="workbench-panel">
        <div className="settings-title">
          <div>
            <h2>人员管理</h2>
            <p>导入时自动学习“Pipeline所有人”并去重；重新导入同一文件也可补齐人员。</p>
          </div>
          <span>{data.people.length} 人</span>
        </div>
        <div className="inline-create">
          <input
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            placeholder="输入人员姓名"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addPerson();
            }}
          />
          <button className="button primary" onClick={() => void addPerson()}>
            <Plus size={15} />
            新增
          </button>
        </div>
        <div className="settings-list">
          {data.people.map((person) => (
            <div key={person.id}>
              <strong>{person.name}</strong>
              <span className={`entity-status ${person.status}`}>
                {person.status === 'active' ? '启用' : '已停用'}
              </span>
              <button className="button ghost" onClick={() => void togglePerson(person)}>
                {person.status === 'active' ? '停用' : '启用'}
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="workbench-panel">
        <div className="settings-title">
          <div>
            <h2>工作类型</h2>
            <p>预置类型和已使用类型不提供删除。</p>
          </div>
          <span>{data.workTypes.length} 类</span>
        </div>
        <div className="inline-create">
          <input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="输入类型名称" />
          <input
            className="color-input"
            type="color"
            value={typeColor}
            onChange={(e) => setTypeColor(e.target.value)}
          />
          <button className="button primary" onClick={() => void addType()}>
            <Plus size={15} />
            新增
          </button>
        </div>
        <div className="settings-list type-list">
          {data.workTypes.map((type, index) => (
            <div key={type.id}>
              <i style={{ background: type.color }} />
              <strong>{type.name}</strong>
              <span className={`entity-status ${type.status}`}>
                {type.status === 'active' ? '启用' : '已停用'}
              </span>
              <span className="sort-actions">
                <button disabled={index === 0} onClick={() => void moveType(type, -1)}>
                  ↑
                </button>
                <button disabled={index === data.workTypes.length - 1} onClick={() => void moveType(type, 1)}>
                  ↓
                </button>
              </span>
              <button className="button ghost" onClick={() => void toggleType(type)}>
                {type.status === 'active' ? '停用' : '启用'}
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="workbench-panel import-baseline-panel">
        <div className="settings-title">
          <div>
            <h2>导入基线</h2>
            <p>首次导入保存完整基线；相同文件自动跳过，后续只记录新增客户、商机和发生变化的快照。</p>
          </div>
          <span>{data.importBatches.length} 批</span>
        </div>
        {data.importBatches.length === 0 ? (
          <p className="empty-analysis">尚未形成基线。请在销售或售前驾驶舱导入 Excel。</p>
        ) : (
          <div className="table-wrap">
            <table className="baseline-table">
              <thead>
                <tr>
                  <th>导入时间</th>
                  <th>来源</th>
                  <th>文件</th>
                  <th>新客户</th>
                  <th>新商机</th>
                  <th>变化快照</th>
                  <th>未变化</th>
                </tr>
              </thead>
              <tbody>
                {data.importBatches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{formatDateTime(batch.importedAt)}</td>
                    <td>{importSourceLabel(batch.sourceModule)}</td>
                    <td>{batch.fileName}</td>
                    <td>{batch.newCustomerCount}</td>
                    <td>{batch.newOpportunityCount}</td>
                    <td>{batch.changedSnapshotCount}</td>
                    <td>{batch.unchangedOpportunityCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MiniCalendar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const dates = monthGridDates(value);
  const month = parseLocalDate(value).getMonth();
  return (
    <div className="mini-calendar">
      <strong>
        {parseLocalDate(value).getFullYear()} 年 {month + 1} 月
      </strong>
      <div className="mini-calendar-grid">
        {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
          <span key={day}>{day}</span>
        ))}
        {dates.map((date) => {
          const text = toDateText(date);
          return (
            <button
              key={text}
              className={`${date.getMonth() !== month ? 'outside' : ''} ${text === value ? 'selected' : ''}`}
              onClick={() => onChange(text)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="workbench-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{hint}</em>
    </article>
  );
}

function BarRow({
  label,
  value,
  max,
  detail,
  color = '#2563eb',
  onClick,
}: {
  label: string;
  value: number;
  max: number;
  detail: string;
  color?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span>{label}</span>
      <i>
        <b style={{ width: `${Math.max(3, (value / max) * 100)}%`, background: color }} />
      </i>
      <strong>{detail}</strong>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className="workbench-bar-row interactive"
        aria-label={`查看${label}工作明细`}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }
  return <div className="workbench-bar-row">{content}</div>;
}

function EmptyAnalysis() {
  return <p className="empty-analysis">当前筛选范围内没有已完成工作。</p>;
}

function eventToDraft(
  event: WorkEvent | null,
  participants: WorkParticipant[],
  data: WorkbenchData,
  defaultDate: string,
): EventDraft {
  const activePeople = data.people.filter((item) => item.status === 'active');
  const defaultOwner = activePeople[0]?.id ?? '';
  return {
    title: event?.title ?? '',
    date: event?.startAt.slice(0, 10) ?? defaultDate,
    entryMode: event?.entryMode ?? 'detailed',
    allDay: event?.allDay ?? false,
    startTime: event && !event.allDay ? event.startAt.slice(11, 16) : '09:00',
    endTime: event && !event.allDay ? event.endAt.slice(11, 16) : '10:00',
    status: event?.status ?? 'planned',
    workTypeId: event
      ? (event.workTypeId ?? '')
      : (data.workTypes.find((item) => item.status === 'active')?.id ?? ''),
    ownerId: event ? (event.ownerId ?? '') : defaultOwner,
    selectedParticipantIds: event
      ? participants.map((item) => item.personId)
      : defaultOwner
        ? [defaultOwner]
        : [],
    participantHours: Object.fromEntries(
      participants.map((item) => [item.personId, String(item.actualMinutes / 60)]),
    ),
    customerId: event?.customerId ?? '',
    temporaryCustomerName: '',
    opportunityId: event?.opportunityId ?? '',
    workMode: event?.workMode ?? '现场',
    location: event?.location ?? '',
    content: event?.content ?? '',
    result: event?.result ?? '',
    nextAction: event?.nextAction ?? '',
    testProjectId: event?.testProjectId ?? '',
    newTestProjectName: '',
  };
}

function validateDraft(draft: EventDraft, isTestWork: boolean) {
  if (!draft.title.trim()) return '请填写工作标题。';
  if (!draft.date) return '请选择工作日期。';
  if (!draft.allDay && (!draft.startTime || !draft.endTime)) return '请填写完整的开始和结束时间。';
  if (!draft.allDay && draft.endTime <= draft.startTime) return '结束时间必须晚于开始时间。';
  if (draft.ownerId && !draft.selectedParticipantIds.includes(draft.ownerId))
    return '负责人必须包含在参与人员中。';
  if (new Set(draft.selectedParticipantIds).size !== draft.selectedParticipantIds.length)
    return '参与人员不能重复。';
  if (draft.customerId === '__temporary__' && !draft.temporaryCustomerName.trim())
    return '请填写临时客户名称。';
  if (isTestWork && !draft.testProjectId) return '测试/POC 工作必须关联测试项目。';
  if (isTestWork && draft.testProjectId === '__new__' && !draft.ownerId)
    return '新建测试项目需要先选择负责人。';
  if (isTestWork && draft.testProjectId === '__new__' && !draft.newTestProjectName.trim())
    return '请填写测试项目名称。';
  return '';
}

function moveWorkEventDate(event: WorkEvent, nextDate: string): WorkEvent {
  if (event.allDay) {
    return {
      ...event,
      startAt: `${nextDate}T00:00:00`,
      endAt: `${nextDate}T23:59:59`,
      updatedAt: new Date().toISOString(),
    };
  }

  const currentStartDate = event.startAt.slice(0, 10);
  const currentEndDate = event.endAt.slice(0, 10);
  const dayOffset = daysBetween(currentStartDate, currentEndDate);
  return {
    ...event,
    startAt: `${nextDate}T${event.startAt.slice(11)}`,
    endAt: `${addDays(nextDate, dayOffset)}T${event.endAt.slice(11)}`,
    updatedAt: new Date().toISOString(),
  };
}

function isFileDrag(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types ?? []).includes('Files');
}

function monthGridDates(value: string) {
  const date = parseLocalDate(value);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - mondayOffset);
  return Array.from(
    { length: 42 },
    (_, index) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + index),
  );
}

function weekDates(value: string) {
  const date = parseLocalDate(value);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return Array.from(
    { length: 7 },
    (_, index) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + index),
  );
}

function calendarTitle(value: string, view: CalendarView) {
  const date = parseLocalDate(value);
  if (view === 'month') return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
  if (view === 'day') return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  const dates = weekDates(value);
  return `${dates[0].getMonth() + 1} 月 ${dates[0].getDate()} 日 — ${dates[6].getMonth() + 1} 月 ${dates[6].getDate()} 日`;
}

function formatSelectedDate(value: string) {
  const date = parseLocalDate(value);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 周${'日一二三四五六'[date.getDay()]}`;
}

function workStatusLabel(status: WorkStatus) {
  if (status === 'completed') return '已完成';
  if (status === 'cancelled') return '已取消';
  return '计划中';
}

function importSourceLabel(source: WorkbenchModule) {
  if (source === 'sales') return '销售';
  if (source === 'presales') return '售前';
  return '工作台';
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateText(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(value: string, days: number) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return toDateText(date);
}

function daysBetween(from: string, to: string) {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86400000);
}

function todayText() {
  return toDateText(new Date());
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function downloadJson(value: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
