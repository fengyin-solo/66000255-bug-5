# solo-6600025: CAN 总线数据帧解析与诊断仪

## 技术栈
- Frontend: Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS + ECharts
- Backend: Java 17 + Spring Boot 3.2.0

## 核心特性
1. **DBC 文件解析**：解析 DBC 格式信号定义，提取 CAN 信号参数
2. **OBD-II 标准 PID 支持**：EngineRPM、VehicleSpeed、CoolantTemp 等标准诊断
3. **实时帧捕获**：模拟 CAN 帧实时采集，支持过滤与搜索
4. **ECharts 时序曲线**：多信号实时趋势对比图
5. **总线负载率分析**：总线利用率统计
6. **CSV 导出**：帧数据导出为 CSV 格式（由后端 `/api/exports` 落盘）

## 导出约定
- **所见即所出**：导出内容即列表当前筛选结果，时间戳、CAN ID、数据与解码信号的格式与列表、详情面板完全一致（共用 `frontend/src/utils/frame-format.ts`）。
- **空批次写明原因**：无帧或筛选命中 0 条时，文件在表头之上写入 `# 导出为空：…` 说明行。
- **不互相覆盖**：同一批次（相同筛选结果，`batchId` 相同）重复导出保存为 `can_frames_<batchId>.csv`、`can_frames_<batchId>_2.csv`、`_3.csv`…；早先批次的文件不会被本次写入覆盖。文件保存在后端 `canbus.export.dir`（默认 `./exports`），写入采用临时文件 + 原子 move。
- **失败可重试**：接口不可用（网络错误/超时/5xx/429）时前端按指数退避自动重试 3 次，仍失败则在页面提示并提供“重试导出”。
- 后端端口为 `8002`，与 Vite 代理一致；可用 `GET /api/exports` 查看已保存文件。
