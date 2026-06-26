import { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { useDataStore } from '../stores/dataStore';

/** 重置 store 到初始状态（每个测试前调用） */
export function resetStore() {
  useDataStore.setState({
    data: null,
    filters: {
      owner: '',
      industryLevel1: '',
      product: '',
      expectedQuarter: '',
      status: '',
      forecastType: '',
    },
    drillFilters: [],
    search: '',
    customerQuery: '',
    activeTab: 'ppl',
    loading: false,
    error: '',
    isDraggingFile: false,
    keyCustomerInput: '',
  });
}

interface ProviderProps {
  children: ReactNode;
}

/** 测试用 Provider 包装器（未来需要时可加 QueryClient 等） */
function AllProviders({ children }: ProviderProps) {
  return <>{children}</>;
}

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
