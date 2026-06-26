import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, resetStore, screen } from '../../test/testUtils';
import { TopBar } from '../layout/TopBar';
import type { ImportReport } from '../../domain';

const mockReport: ImportReport = {
  fileName: 'test.xlsx',
  importedAt: '2026/6/26 10:00:00',
  pplRows: 100,
  summaryRows: 18,
  activityRows: 5,
  skippedRows: 2,
  detectedFields: ['销售：Pipeline所有人'],
  missingFields: [],
  warnings: [],
};

describe('TopBar', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should_render_title', () => {
    render(<TopBar report={null} hasData={false} onUpload={() => undefined} onClear={() => undefined} />);
    expect(screen.getByText('江苏省办销售经营驾驶舱')).toBeInTheDocument();
  });

  it('should_show_report_info_when_provided', () => {
    render(<TopBar report={mockReport} hasData onUpload={() => undefined} onClear={() => undefined} />);
    expect(screen.getByText(/当前文件：test\.xlsx/)).toBeInTheDocument();
    expect(screen.getByText(/PPL 100 条/)).toBeInTheDocument();
  });

  it('should_show_placeholder_when_no_report', () => {
    render(<TopBar report={null} hasData={false} onUpload={() => undefined} onClear={() => undefined} />);
    expect(screen.getByText(/当前文件：未导入文件/)).toBeInTheDocument();
  });

  it('should_call_onUpload_when_file_selected', () => {
    const onUpload = vi.fn();
    render(<TopBar report={null} hasData={false} onUpload={onUpload} onClear={() => undefined} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'data.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it('should_disable_clear_button_when_no_data', () => {
    render(<TopBar report={null} hasData={false} onUpload={() => undefined} onClear={() => undefined} />);
    const clearButton = screen.getByText('清空').closest('button')!;
    expect(clearButton).toBeDisabled();
  });

  it('should_enable_clear_button_when_has_data', () => {
    render(<TopBar report={mockReport} hasData onUpload={() => undefined} onClear={() => undefined} />);
    const clearButton = screen.getByText('清空').closest('button')!;
    expect(clearButton).not.toBeDisabled();
  });

  it('should_call_onClear_when_clear_clicked', () => {
    const onClear = vi.fn();
    render(<TopBar report={mockReport} hasData onUpload={() => undefined} onClear={onClear} />);
    fireEvent.click(screen.getByText('清空'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('should_reset_input_value_after_upload_to_allow_repeat_same_file', () => {
    // H7 修复：重置 input value 以允许重复上传同名文件
    const onUpload = vi.fn();
    render(<TopBar report={null} hasData={false} onUpload={onUpload} onClear={() => undefined} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'same-name.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(fileInput.value).toBe('');
  });
});
