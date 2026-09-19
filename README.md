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
6. **CSV 导出**：帧数据导出为 CSV 格式

## 导出说明（CSV）
- 导出内容来自当前列表可见的帧（含搜索/筛选结果），时间、CAN ID、方向、数据、解码信号均与页面逐字一致。
- 接口：`POST /api/export/frames`，请求体为按页面格式预渲染好的帧行；服务端按命名属性生成带 UTF-8 BOM 的 CSV（RFC 4180 转义）。
- 空批次（未捕获到帧或筛选零命中）仍会导出文件，表头下方写明为空原因与导出时间。
- 文件名形如 `can_frames_YYYYMMDD-HHMMSSmmm_<序号>_<随机串>.csv`，重复导出互不覆盖；仅在接口成功返回后落盘。
- 接口不可用/超时时导出失败并弹出“重试导出”，重试复用同一批快照，失败不会产生或覆盖任何文件。

## 端口
- 前端 Vite 开发服务器：`5180`，`/api` 代理到后端 `http://localhost:8080`
- 后端 Spring Boot：`8080`
