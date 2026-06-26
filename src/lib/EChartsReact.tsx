/**
 * ECharts React 包装器。
 *
 * 默认的 `echarts-for-react` 入口会全量引入 echarts（约 1.1MB）。
 * 这里改用 `echarts-for-react/lib/core` 子模块，配合 `echarts-setup.ts` 中的
 * 按需注册，把 echarts 包压缩到 ~150KB。
 */
import EChartsReactCore from 'echarts-for-react/lib/core';
import type { EChartsInstance } from 'echarts-for-react';
import type { CSSProperties } from 'react';
import { echarts } from './echarts-setup';

export interface EChartsReactProps {
  option: object;
  style?: CSSProperties;
  className?: string;
  theme?: string | object;
  onChartReady?: (instance: EChartsInstance) => void;
  // 事件回调签名各不相同，使用宽松的函数类型
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEvents?: Record<string, (...args: any[]) => void>;
  notMerge?: boolean;
  opts?: object;
}

export function EChartsReact({
  option,
  style,
  className,
  theme,
  onChartReady,
  onEvents,
  notMerge,
  opts,
}: EChartsReactProps) {
  return (
    <EChartsReactCore
      echarts={echarts}
      option={option}
      style={style}
      className={className}
      theme={theme}
      onChartReady={onChartReady}
      onEvents={onEvents}
      notMerge={notMerge}
      opts={opts}
    />
  );
}