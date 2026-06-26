/**
 * ECharts 6 按需注册。
 *
 * 通过只注册我们用到的图表类型与组件，把 echarts 从 1.1MB 压到 ~150KB。
 * 任何新图表类型（如散点图、雷达图）需要在此追加注册。
 */
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  // 图表类型
  BarChart,
  LineChart,
  PieChart,
  // 组件
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  // 渲染器
  CanvasRenderer,
]);

export { echarts };
