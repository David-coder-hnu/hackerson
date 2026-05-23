# TerraDiagnosis / 地脉·镜

> 3D 交互式地形沙盘 —— 推沙成世界，一镜诊山河。

## 项目简介

灵感来自科技馆的 AR 实体沙盘教具。纯数字版，浏览器打开即可使用。

**创作阶段**：鼠标推拉地形，实时等高线浮现。手指一动，山就起来了。

**揭示阶段**：锁定地形后，系统自动诊断——季风吹起，云层撞上山脉变成雨，河流从高山流向低地，湖泊在洼地形成。看你创造的大陆「活过来」。

最终生成**星球档案**——地形分类、气候带、水文摘要。这是这个星球的地理身份证。

## 技术栈

| 层 | 技术 |
|---|---|
| 3D 渲染 | Three.js + React Three Fiber |
| 等高线 | 自定义 fragment shader (GLSL) |
| 状态管理 | Zustand |
| 水文模拟 | D8 流向 + 流量累积 (Web Worker) |
| 气候模拟 | 主导风向 + 地形抬升降雨 |
| 构建 | Vite |
| 部署 | GitHub Pages (纯静态) |

## 架构

```
主线程 (UI)
├── React UI (笔刷/锁定/预设)
├── R3F 3D 场景渲染
│   ├── TerrainMaterial (编辑模式 — 等高线 shader)
│   └── BiomeMaterial (观察模式 — 气候着色)
├── 星球档案面板
└── Zustand Store { heightmap, mode, brush, results }
            │ postMessage
            ▼
Web Worker (模拟引擎)
├── 水文模型 (D8 + 洼地填充 + 湖泊检测)
└── 气候模型 (风场 + 降水 + 温度梯度)
```

## 核心功能 (Hackathon MVP)

- **3D 地形雕刻**：Raise / Lower / Flatten / Smooth 笔刷，高斯衰减核
- **实时等高线**：fragment shader 渲染，单次 draw call
- **地形预设**：火山岛、山脉链、陨石坑湖、群岛
- **锁定 + 诊断**：水文 (D8) → 气候 (风+降水) → 逐层渲染
- **星球档案**：地形分类、气候带、水文摘要
- **撤销/重做**：20 步环形缓冲区
- **天气粒子**：雨、雪、风粒子效果
- **动态水面**：法线贴图波浪动画
- **分享 URL**：高度图 LZ-String 压缩到 URL hash

## 成功标准

- [ ] 推拉地形，实时等高线变化 (30+ fps)
- [ ] 锁定后自动生成河流网络
- [ ] 迎风坡湿绿、背风坡干黄
- [ ] 星球档案展示 3 项分析结果
- [ ] 构建产物 < 3MB gzipped

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 设计文档

- [工程设计文档](docs/design.md) — 完整技术规格、数据契约、笔刷数学、错误处理
- [CEO 范围计划](docs/ceo-plan.md) — 愿景、范围决策、技术风险
- [测试计划](docs/test-plan.md) — 关键交互、边缘案例、单元测试规格

## Post-Hackathon Roadmap

- 河流侵蚀模拟 (stream power law)
- 洋流 + 科里奥利效应
- 生物群落详细分类 (Köppen 简化版)
- 多人协作地形编辑
- 移动端触摸交互
- 音频（风、水、雨）
