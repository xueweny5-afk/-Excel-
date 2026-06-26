# 江苏省办销售 Pipeline 本地分析工作台

> 纯前端本地看板。用户在浏览器上传 Excel 后，数据只在本机浏览器内解析和分析，**不依赖后端、不上传服务器**。

适用于江苏省办销售团队对 Pipeline 明细 / 数据汇总 / 活动记录做本地分析与重点客户商机挖掘。

---

## ✨ 功能

### PPL 明细 Tab
- 📥 **拖拽上传 Excel**：支持 `.xlsx` / `.xls` / `.csv`
- 🔍 **多维筛选**：销售 / 一级行业 / 产品 / 季度 / 状态 / Forecast
- 🏷️ **图表下钻**：点击柱状图某项 → 自动筛选明细
- 📊 **6 个核心图表**：销售 TOP / 行业分布 / 产品排行 / 季度趋势 / 健康度 / Forecast 结构
- 📈 **6 个 KPI 卡片**：总金额 / 商机数 / 客户数 / 加权赢单率 / Forecast / 风险商机数
- 🔎 **智能搜索**：跨字段模糊匹配客户、销售、产品、商机
- 📤 **CSV 导出**：明细表 / 聚合表可下载
- 📋 **双视图**：明细表 / 客户×产品×阶段 聚合表可切换

### 重点客户分析 Tab
- 🎯 **多客户匹配**：粘贴 38 家 T2000 客户 → 自动匹配 PPL 中的商机
- ✅ **三层匹配**：精确 → 别名 → 模糊
- 📊 **匹配率可视化**：匹配成功率、置信度分布、匹配方式分布
- 💡 **30+ 内置别名**：覆盖金融 / 央企 / 省属国企 / 互联网

### 数据汇总 + 活动记录 Tab
- 📑 直接展示原始字段，便于核对数据源

---

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 开发模式（实时刷新）
npm run dev
# → 浏览器打开 http://127.0.0.1:5173

# 生产构建
npm run build
# → 输出到 dist/

# 预览生产版本
npm run preview

# 类型检查
npm run typecheck
```

### 测试

```bash
# 跑全部测试
npm test

# 监听模式
npm run test:watch

# 覆盖率报告
npm run test:coverage
# → 报告输出到 coverage/index.html
```

---

## 🛠️ 技术栈

| 维度 | 选择 | 版本 |
|---|---|---|
| 框架 | React | 19 |
| 语言 | TypeScript | 5.9 |
| 构建 | Vite | 7 |
| 状态 | Zustand | 4 |
| 图表 | ECharts (按需引入) | 6 |
| Excel | SheetJS (xlsx) | 0.18.5 |
| 表格 | TanStack Table | 8 |
| 图标 | lucide-react | 0.561 |
| 测试 | Vitest + Testing Library | 4 |

**生产构建产物（gzip 后）**：

| Chunk | 体积 | 加载时机 |
|---|---|---|
| index.js | 89 KB | 首屏 |
| zustand.js | 4 KB | 首屏 |
| echarts.js | 200 KB | 渲染图表时 |
| xlsx.js | 114 KB | 上传文件时 |

**首屏仅 93 KB gzip**，适合内网部署。

---

## 📁 项目结构

```
sales-dashboard/
├── src/
│   ├── main.tsx              入口（ErrorBoundary 包裹）
│   ├── App.tsx               根组件（155 行）
│   ├── domain.ts             类型定义
│   ├── styles.css            全局样式
│   ├── stores/dataStore.ts   Zustand 全局状态
│   ├── hooks/                自定义 hook
│   │   ├── useFilteredPpl.ts       派生筛选数据
│   │   ├── useChartAggregations.ts 聚合数据 memo
│   │   └── useFileDrop.ts          拖拽逻辑
│   ├── lib/                  工具模块
│   │   ├── parser.ts                Excel 解析
│   │   ├── analyzer.ts              KPI / 聚合 / 导出
│   │   ├── customerMatcher.ts       客户匹配
│   │   ├── customerAnalyzer.ts      重点客户分析
│   │   ├── chartOptions.ts          ECharts 配置
│   │   ├── echarts-setup.ts         按需注册
│   │   ├── EChartsReact.tsx         core-only 包装器
│   │   ├── formatters.ts            数字/百分比格式化
│   │   ├── normalize.ts             客户名规范化
│   │   └── __tests__/               lib 单元测试
│   ├── components/           UI 组件
│   │   ├── ErrorBoundary.tsx
│   │   ├── common/                  StatusCard / InsightBanner / DashboardCard
│   │   ├── layout/                  TopBar / TabBar
│   │   ├── upload/                  FileDropZone / ImportReport
│   │   ├── filters/                 FilterBar / DrillTags
│   │   ├── kpi/                     KpiGrid / MetricCard
│   │   ├── charts/                  ChartCard / ChartGrid / DistributionCard / HealthCard
│   │   ├── tables/                  PplTable / DetailDrawer / KeyCustomerDetailTable / ...
│   │   ├── keyCustomers/            KeyCustomerView / MatchResultCharts / ...
│   │   └── __tests__/               组件集成测试
│   └── test/                 测试基础设施
├── vite.config.ts            Vite 配置（manualChunks 拆分）
├── vitest.config.ts          Vitest 配置
└── tsconfig.{json,app,node}
```

---

## 🧪 测试

```
Test Files  8 passed (8)
     Tests  72 passed (72)
```

| 模块 | 覆盖率 | 备注 |
|---|---|---|
| customerMatcher.ts | **96.87%** | 核心匹配逻辑 |
| analyzer.ts | **72.46%** | 筛选 + 聚合 + KPI |
| TopBar.tsx | **66.66%** | 上传/清空交互 |
| formatters.ts | **75.00%** | 格式化工具 |

**TDD 价值**：测试过程发现 2 个真实 bug：
1. `groupAmount` 同金额排序不稳定 → 加 tiebreaker
2. `normalize` 缺少 `控股` / `控股有限公司` 后缀 → 补全

---

## 🔧 关键设计

### 数据流单向
```
[用户上传 Excel]
      ↓
[parser.ts 解析] → typed data
      ↓
[Zustand store] → 原始数据 + 全局筛选
      ↓
[useFilteredPpl hook] → useMemo 派生数据
      ↓
[各组件] → 消费派生数据
```

### 客户匹配三层策略
```
输入"南京证券"
   ↓ 1. 精确匹配（归一化后相等）
   ↓ 2. 别名匹配（查内置别名表）
   ↓ 3. 模糊匹配（双向包含）
   ↓
返回 { matchedCustomerName, matchType, confidence }
```

### 健康度算法
```
score = stageScore * 0.4 + winRate * 0.3 + closeDateScore * 0.2 + amountScore * 0.1
  ↓ ≥ 0.7 → 健康
  ↓ ≥ 0.4 → 关注
  ↓ < 0.4 → 风险
附加规则：金额=0、客户名为空、过期未关闭、本季度+早期阶段 → 降级
```

---

## 🌐 部署

### 内网 Nginx
```nginx
server {
  listen 8080;
  root /opt/sales-dashboard/dist;
  location / { try_files $uri $uri/ /index.html; }
}
```

### 简单 HTTP 服务
```bash
npx serve dist -p 8080
```

### 部署后访问
```
http://公司内网IP:8080
```

数据只在浏览器本地处理，**不会上传到服务器**。

---

## 📝 维护指南

### 新增客户别名
编辑 `src/lib/customerMatcher.ts` 的 `CUSTOMER_ALIASES`：
```ts
export const CUSTOMER_ALIASES: Record<string, string[]> = {
  // 添加你的别名
  简称: ['全称1', '全称2'],
};
```

### 新增图表类型
1. 在 `src/lib/echarts-setup.ts` 引入并注册新图表类型
2. 在 `src/lib/chartOptions.ts` 添加对应 option 构造器
3. 在 `src/components/charts/` 新建展示组件

### 新增字段映射
编辑 `src/fieldAliases.ts` 的 `PPL_FIELD_ALIASES`：
```ts
owner: ['Pipeline所有人', '销售', '负责人', '商机负责人'],
// 添加你的字段别名
owner: ['Pipeline所有人', '销售', '负责人', '商机负责人', '新字段名'],
```

---

## 🤝 贡献

提交前请确保：
- [ ] `npm run typecheck` 通过
- [ ] `npm test` 全部通过
- [ ] 新功能有对应测试
- [ ] 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)

---

## 📜 License

Internal use — 江苏省办销售团队