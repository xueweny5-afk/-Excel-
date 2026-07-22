# 售前工作台动态日期新增 — Design QA

- Source visual truth: `C:\Users\大文\.codex\attachments\3d7e8c6e-4d92-4409-ba51-8a5355dd48a0\image-1.png`
- Implementation screenshot: `D:\project\WorK_Space\sales-dashboard\output\playwright\workbench-inline-create-open.png`
- Saved-result screenshot: `D:\project\WorK_Space\sales-dashboard\output\playwright\workbench-dynamic-calendar-final.png`
- Responsive screenshot: `D:\project\WorK_Space\sales-dashboard\output\playwright\workbench-dynamic-calendar-laptop.png`
- Viewport: 1366 × 768 desktop; 1024 × 768 laptop breakpoint
- State: month calendar, selected date, date-cell quick composer open; saved-result state also verified

## Findings

- No remaining P0/P1/P2 findings.
- The reference is used as an interaction and calendar-density target rather than a full product skin replacement. The implementation intentionally keeps the existing SALES-DASHBOARD blue-gray cards, toolbar, sidebar filters, and selected-day panel.

## Required fidelity surfaces

- Fonts and typography: Existing dashboard font stack and weights are preserved. Date hierarchy, compact event labels, and quick-composer title/input hierarchy remain readable at both checked widths.
- Spacing and layout rhythm: The selected cell, anchored composer, event chips, and right-hand selected-day panel align to the existing grid. The composer flips horizontally near right columns and upward on the last calendar row to avoid clipping.
- Colors and visual tokens: Selection, focus, and primary actions reuse the product accent blue; draft and success states retain their established semantic colors.
- Image quality and asset fidelity: The source contains no required product imagery for this interaction. Existing Lucide icons are reused; no placeholder or handcrafted image assets were introduced.
- Copy and content: “输入工作标题，回车保存”“保存为计划草稿” and the success feedback state make the quick-add behavior and statistics boundary explicit.

## Full-view comparison evidence

- The source and implementation were opened together and compared for calendar hierarchy, selected-date emphasis, sidebar/calendar balance, compact event treatment, and direct date-cell action affordance.
- The implementation preserves the source pattern of a persistent month grid with visible event items while adding an anchored quick composer needed by the requested click-to-add flow.

## Focused region comparison evidence

- Focused comparison used the selected date cell and quick-composer region because the requested fidelity is interaction-specific.
- The date remains visibly selected behind the composer, the composer is visually attached to the cell, and the saved event appears in both the cell and selected-day list.

## Comparison history

1. Initial browser pass confirmed the date-cell composer and focus behavior, but automated Enter submission did not produce an authoritative saved-state signal.
2. Added an explicit Enter-key handler while retaining normal form submission.
3. Post-fix browser pass created “准备周二方案沟通” with Enter, showed the new item in the month cell and selected-day panel, and produced no console errors or warnings.
4. At 1024 px, the page had no horizontal document overflow (`scrollWidth === clientWidth`); the selected-day panel continued below the calendar according to the existing breakpoint.

## Implementation checklist

- [x] Click a month date to open and focus an anchored quick composer.
- [x] Save with Enter or the Add button.
- [x] Close with Escape or the close icon.
- [x] Animate date selection, composer reveal, view transitions, saved events, and success feedback.
- [x] Respect `prefers-reduced-motion`.
- [x] Keep drafts in local persistence and out of completion statistics.
- [x] Verify month/week interaction, desktop/laptop responsiveness, and browser console.

## Follow-up polish

- No remaining scoped P3 items after the fixed-cell scrolling update.

## Browser Comment 1 — fixed date cells and internal scrolling

- Source visual truth: browser comment marker 1 screenshot in the current task (`browser://comment/1`), 944 × 791 viewport.
- Implementation screenshot: `D:\project\WorK_Space\sales-dashboard\output\playwright\workbench-fixed-cells-944.png`.
- State: month view at 944 × 791 with two items on July 1 and the browser comment marker visible.
- Finding addressed: month cells previously used `min-height` and rendered only four items plus a summary. This could hide the remaining work and allowed content pressure to affect row sizing.
- Fix: the month grid now has six fixed 126px rows; every event is rendered in an absolutely bounded date-cell list with `overflow-y: auto`, thin scrollbar styling, and contained overscroll.
- Full-view comparison: the surrounding toolbar, sidebar, calendar layout, colors, typography, and quick-add interaction remain unchanged; only the annotated calendar-cell overflow behavior changed.
- Focused comparison: all 42 rendered date cells measured exactly 126px high. The July 1 work list measured 81px client height and 108px scroll height with `overflow-y: auto`, proving that overflow stays inside the selected cell. Document `scrollWidth` equaled `clientWidth`, so the change introduced no horizontal page overflow.
- Browser checks: month rendering, fixed row sizing, visible cell scrollbar, selected-date state, and console output were inspected in the annotated in-app browser.
- Fonts/typography: unchanged from the established dashboard design system; event labels continue to truncate within their fixed-width rows.
- Spacing/layout rhythm: fixed rows keep all date frames aligned; the internal list reserves the 38px date-header area.
- Colors/tokens: the scrollbar reuses the existing light-blue border token family and does not compete with the selected-state accent.
- Image/assets: no image assets were added or replaced.
- Copy/content: all work titles remain present; the former “还有 N 条” truncation summary is no longer used.
- Comparison history: initial annotated state showed the calendar cell as the overflow target; post-fix browser measurement and screenshot confirm fixed sizing and internal overflow behavior. No P0/P1/P2 findings remain.
- Regression evidence: a seven-item unit scenario confirms that all items remain in the DOM and no truncation summary appears.

## Browser Comment 2 — settings add-button typography

- Source visual truth: browser comment marker 1 screenshot in the current task (`browser://comment/1`), 944 × 791 viewport.
- Implementation screenshot: `D:\project\WorK_Space\sales-dashboard\output\playwright\workbench-settings-add-button-944.png`.
- Finding addressed: the personnel and work-type inputs consumed the available flex width, allowing both “新增” buttons to shrink until the two-character label wrapped vertically.
- Fix: text inputs now shrink within the row, the color input keeps its 48px width, and both add buttons use a 76px minimum width, 13px semibold type, compact horizontal padding, and `white-space: nowrap`.
- Focused comparison: both buttons measured 76 × 38.5px with 13px text, `white-space: nowrap`, and 74px scroll width inside a 76px client width, confirming that icon and label fit on one line without clipping.
- Full-view comparison: the two settings cards, toolbar, type list, colors, and surrounding spacing remain unchanged; the scoped adjustment only rebalances the inline-create rows.
- Browser checks: both “新增” controls were inspected at the annotated viewport and rendered as matching single-line buttons with aligned heights.
- Fonts/typography: button text now matches the compact 13px control scale already used in the settings card.
- Spacing/layout rhythm: both buttons retain the existing 8px row gap and align with their neighboring 38.5px inputs.
- Colors/tokens: unchanged; the primary action continues to use the existing accent-blue token.
- Image/assets: no image assets were added or replaced; the existing Lucide plus icon remains in use.
- Copy/content: unchanged.
- Regression evidence: Prettier, 213 unit tests, TypeScript, ESLint, and production build pass.
- No remaining P0/P1/P2 findings in this scoped annotation.

## Browser Comments 1–3 — direct content, fuzzy customer search, and comparison history

- Source visual truth: the three annotated browser screenshots in the current task (`browser://comment/1`, `browser://comment/2`, and `browser://comment/3`), 944 × 791 viewport.
- Direct-entry screenshot: `D:\project\WorK_Space\sales-dashboard\output\playwright\workbench-direct-content-fuzzy-history-944.png`.
- Persistence screenshot: `D:\project\WorK_Space\sales-dashboard\output\playwright\workbench-persistence-history-944.png`.
- State: month calendar with the in-cell composer open, fuzzy-search placeholder visible, and the workbench persistence summary visible after a full page refresh.

### Findings and fixes

- [P1 resolved] The in-cell composer previously accepted only a title, forcing users to reopen the draft to enter the actual work description. It now provides a 1000-character multiline content field; the first non-empty line becomes the calendar title and the full text is persisted in `WorkEvent.content`. Ctrl/Command + Enter or the Add button saves the draft.
- [P1 resolved] Customer filtering previously performed only a contiguous lowercase match against the event-name snapshot and the selected-day panel ignored the filter. It now normalizes punctuation, spacing, width, and case; supports ordered fuzzy characters and multiple terms; searches the saved snapshot, current canonical name, and aliases; and filters both the calendar and selected-day list.
- [P1 resolved] Work events previously persisted only their latest value. IndexedDB schema version 2 adds append-only event revisions containing the complete event and participant allocations on every save or cancellation. Existing events receive one baseline revision automatically; import batches and opportunity snapshots continue to remain isolated and versioned.

### Visual comparison evidence

- Full-view comparison: the existing sidebar, fixed calendar cells, blue-gray cards, toolbar, and responsive composition remain unchanged. The only visible additions are the larger multiline composer, clearer fuzzy-search placeholder, and concise persistence counters.
- Focused comparison: at 944 × 791 the composer measured 320 × 210px and the textarea measured 296 × 114px. The composer stayed inside the viewport with no document-level horizontal overflow.
- Fonts and typography: existing dashboard font stack and hierarchy are preserved; new helper copy uses the established compact secondary-text scale.
- Spacing and layout rhythm: the textarea expands within the existing anchored composer and selected-day grid without changing calendar row sizes or sidebar width.
- Colors and visual tokens: unchanged; focus, primary action, draft, and persistence states reuse existing tokens.
- Image quality and assets: no new image assets were required; existing Lucide icons remain unchanged.
- Copy and content: the composer now states that users can directly enter work content and that the first line becomes the title; the customer input states fuzzy-search support; the persistence card reports work, history, and opportunity-snapshot counts.

### Interaction and persistence evidence

- A two-line work description remained intact in the composer, and Escape closed it without creating a record.
- Unit coverage confirms Ctrl + Enter stores the full multiline content while using its first line as the title.
- Fuzzy-search coverage confirms aliases, normalized punctuation/spacing, multiple keywords, and ordered non-contiguous matching; an integration test confirms the selected-day panel follows the same filter.
- The live database upgraded without losing its two existing events, backfilled two baseline revisions, retained 210 opportunity snapshots, and showed the same `2 条工作 · 2 条历史 · 210 条商机快照` summary after a full refresh.
- Prettier, 216 tests, TypeScript, ESLint, and the production build pass.
- No remaining P0/P1/P2 findings in these scoped annotations.

## Browser Comment 4 — calendar title-first event cards

- Source visual truth: the annotated browser screenshot in the current task (`browser://comment/1`), 944 × 791 viewport.
- Implementation screenshot: `D:\project\WorK_Space\sales-dashboard\output\playwright\workbench-event-title-first-944.png`.
- Finding addressed: calendar event cards used the customer name as the primary label when present and reserved a second row for the work type or “待完善”, reducing the space available for the actual work name.
- Fix: calendar cards now always render `WorkEvent.title` as the primary label, retain only the compact all-day/time prefix, and omit the work-type/draft-status row. The selected-day list likewise omits “待完善” for drafts while preserving type text when a real type exists.
- Focused comparison: the two live July 1 cards contain only `全天 + 工作名称`; both measured without an `em` status node, and neither title overflowed its available 37px title track.
- Full-view comparison: calendar sizing, internal scrolling, event colors, selected date, filters, and surrounding layout remain unchanged.
- Fonts/typography: existing 10px time and 11px semibold title styles remain; removing the third label restores a clear single-line name hierarchy.
- Spacing/layout rhythm: unchanged card padding and grid alignment; the removed status row reduces unnecessary card height pressure.
- Colors/tokens: unchanged.
- Image quality/assets: no image assets were added or changed.
- Copy/content: “待完善” is no longer shown in calendar or selected-day event summaries; the draft completion guidance remains available inside the editing form where it is actionable.
- Regression evidence: 217 tests, TypeScript, ESLint, and production build pass.
- No remaining P0/P1/P2 findings in this scoped annotation.

## Browser Comment 5 — direct completion toggle and strikethrough

- Source visual truth: the annotated browser screenshot in the current task (`browser://comment/1`), 944 × 791 viewport.
- Implementation screenshot: `D:\project\WorK_Space\sales-dashboard\output\playwright\workbench-direct-complete-strikethrough-944.png`.
- Finding addressed: users could open the editor and change status, but could not mark a calendar memo complete in place; cancellation was the only state visibly struck through.
- Fix: each calendar event now has an independent 18px completion control. Selecting it changes the event to `completed`, persists the new revision, fills the control with the existing success green, and strikes through the time/title. Selecting it again restores `planned`.
- Focused comparison: the verified event rendered `.work-event-pill.completed`, `aria-pressed="true"`, an 18 × 18px completion control, and computed `text-decoration-line: line-through` on the event content.
- Full-view comparison: calendar cells, internal scrolling, event-title hierarchy, sidebar, and toolbar remain unchanged; the compact completion control fits without document-level horizontal overflow.
- Fonts/typography: unchanged; the strikethrough applies only to the time/title content, not the control.
- Spacing/layout rhythm: the existing event row now reserves 20px for the completion control and keeps the work title in the flexible track.
- Colors/tokens: completed controls use the existing success green; planned controls remain neutral with an accent hover state.
- Image quality/assets: the existing Lucide Check icon is reused; no new image assets were introduced.
- Copy/content: accessible labels announce “标记…为已完成” and “恢复…为计划中”; no extra visible status copy competes with the work name.
- Statistics safeguard: directly checked quick memos are persisted as completed for checklist behavior but remain outside workload totals until owner, work type, and specific time are complete.
- Interaction evidence: browser verification toggled a planned memo to completed, captured the pressed/struck state, then toggled it back to planned. The isolated verification record was restored afterward.
- Regression evidence: 218 tests, TypeScript, ESLint, and production build pass.
- No remaining P0/P1/P2 findings in this scoped annotation.

## Browser Comment 6 — learn people from Pipeline所有人

- Source visual truth: the annotated personnel-management screenshot in the current task (`browser://comment/1`), 944 × 791 viewport.
- Implementation screenshot: `D:\project\WorK_Space\sales-dashboard\output\playwright\workbench-people-learning-944.png`.
- Finding addressed: personnel management remained empty after importing customer/opportunity data, even though the imported Pipeline rows already contained `Pipeline所有人`.
- Fix: every workbench import now extracts that parsed owner field, splits common multi-person delimiters, normalizes and deduplicates names, and inserts only missing people into the isolated workbench people store. Existing inactive people retain their status.
- Duplicate-import behavior: reimporting a previously captured file runs personnel backfill without adding a customer/opportunity batch. The live isolated check kept the baseline at 2 batches and personnel at 2 while reporting that the repeated file was not written again.
- Focused interaction evidence: a two-row XLSX containing `测试甲、测试乙` and a repeated `测试甲` produced “识别 2 人，新增 2 人”; Settings then showed exactly `测试甲` and `测试乙`. Reimport reported “无需重复新增”.
- Full-view comparison: the existing two-card settings layout, inline manual-add controls, work-type list, typography, colors, and spacing remain unchanged. The personnel helper line now explains automatic learning and same-file backfill within the existing secondary-text scale.
- Responsive evidence: at the annotated viewport the personnel card measured 434 × 543px, document `scrollWidth` equaled `clientWidth`, and the helper line wrapped without clipping or control displacement.
- Persistence and isolation: learned names use the existing IndexedDB people store in the workbench database only; sales/presales dashboard state is untouched. New imports persist people atomically with customer, opportunity, snapshot, and batch writes.
- Regression evidence: 220 tests, TypeScript, ESLint, production build, live XLSX import, repeated-file deduplication, and browser console checks pass.
- No remaining P0/P1/P2 findings in this scoped annotation.

## Browser Comment 7 — permanently delete mistaken work records

- Source visual truth: the annotated month-calendar screenshot in the current task (`browser://comment/1`), 944 × 791 viewport.
- Implementation screenshot: `D:\project\WorK_Space\sales-dashboard\output\playwright\workbench-delete-event-944.png`.
- Finding addressed: an accidentally created calendar memo could be cancelled but not removed, leaving the incorrect record and its history in local persistence.
- Fix: opening an existing calendar item now exposes a distinct red `删除记录` action in the edit drawer. It is separated from `取消工作`, uses the existing Lucide trash icon, and requires an explicit irreversible-delete confirmation containing the work title.
- Data integrity: deletion runs one IndexedDB transaction across the work event, participant allocations, and all revisions for that event. Test projects, customers, opportunities, and unrelated work records remain untouched.
- Focused comparison: at 944 × 791 the action row keeps `删除记录`, `取消工作`, `关闭`, and `保存记录` on a clear two-sided layout. The delete button measured 115 × 38px and the drawer introduced no document-level horizontal overflow.
- Full-view comparison: the calendar, event cards, completion controls, sidebar, and form layout remain unchanged. Only the annotated record-management path gained the missing delete affordance.
- Fonts/typography: the delete label uses the existing button scale and semibold weight; it remains single-line with its icon.
- Spacing/layout rhythm: destructive actions are grouped at the left of the existing drawer footer while close/save remain aligned at the right; the row wraps safely at narrow widths.
- Colors/tokens: the existing danger border, foreground, and soft-red background are reused; no new visual token was introduced.
- Image quality/assets: the established Lucide icon set supplies the trash icon; no raster or custom-drawn assets were added.
- Copy/content: confirmation explicitly says the record cannot be restored and that related person-effort and history records are deleted together, distinguishing permanent deletion from cancellation.
- Interaction evidence: isolated browser verification deleted one test record, reducing the persistent summary from 2 work / 4 history to 1 work / 1 history while keeping 2 opportunity snapshots. The user’s 5173 records were not used for destructive verification.
- Regression evidence: 221 tests, TypeScript, ESLint, production build, live IndexedDB deletion, and browser console checks pass.
- No remaining P0/P1/P2 findings in this scoped annotation.

final result: passed

---

## Browser Comment 11 — completed draft save is blocked

source visual truth path: `C:/Users/大文/AppData/Local/Temp/codex-clipboard-9c838984-a78a-4593-9094-76fc2d420f61.png`

implementation screenshot path: not captured for a live save state because the verification would mutate the user's current IndexedDB work records.

viewport: Codex in-app browser desktop viewport from user-provided screenshot

state: 售前工作台 / 工作日历 / 编辑抽屉，状态选择为“已完成”，仍勾选“全天或暂未安排具体时间”，未选择负责人和工作类型。

full-view comparison evidence: The screenshot shows the user trying to save a completed work draft with incomplete fields. The implementation now supports this path by allowing completed drafts to save without requiring owner, work type, or concrete time.

focused region comparison evidence: Automated test `can save an all-day incomplete draft as completed without required owner or type` opens an all-day draft, changes status to completed, clicks save, and verifies `saveWorkEvent` is called with `status: completed`, `allDay: true`, `ownerId: undefined`, `workTypeId: undefined`, and no participants. It also verifies no zero-duration confirmation dialog appears when no participants were selected.

findings: no actionable P0/P1/P2 issues.

comparison history:

- Initial bug: validation blocked completed drafts unless owner, work type, and concrete time were filled.
- Fix: removed those three hard blockers for completed status and changed the zero-duration confirmation to apply only when participants are selected.
- Copy update: draft notice now explains that incomplete completed records can save, and statistics only use filled personnel/type/hour fields.

primary interactions tested: edit existing draft → choose completed → save record.

console errors checked: not applicable for non-mutating automated path.

final result: passed

---

## Browser Comment 9 — drag work item to reschedule

source visual truth path: `C:/Users/大文/AppData/Local/Temp/codex-clipboard-7954189e-cd59-478e-81cd-1d889dff2af1.png`

implementation screenshot path: `D:/project/WorK_Space/sales-dashboard/output/playwright/workbench-drag-reschedule-static-check.png`

viewport: existing Codex in-app browser desktop viewport

state: 售前工作台 / 工作日历 / 月视图，已有工作项显示在月历日期格中

full-view comparison evidence: Source marks month-calendar event pills as the interaction target. Implementation keeps the same pill layout and adds drag affordance without changing calendar density or surrounding panels.

focused region comparison evidence: Non-destructive browser inspection confirmed 3 `.work-event-pill` elements are present, all 3 have `draggable="true"`, the title hint is `拖到其他日期可调整时间`, and `.calendar-day.drag-over` styles are loaded. A real drop was not performed in the live browser because it would modify the user's current IndexedDB records; automated tests cover the save behavior.

findings: no actionable P0/P1/P2 issues.

comparison history:

- Initial implementation added native drag state, drop-target highlight, and date migration logic.
- Automated interaction test verifies dragging a timed event from `2026-07-01` to `2026-07-02` saves `startAt: 2026-07-02T10:30:00` and `endAt: 2026-07-02T11:45:00`, preserving the time range.
- Browser read-only check verified the live UI exposes draggable event pills and loaded drop target styling.

primary interactions tested: unit/integration dragStart → dragOver → drop → `saveWorkEvent`; browser static check for draggable affordance.

console errors checked: not applicable for non-mutating static DOM check.

final result: passed
