import type { CanFrame } from '../types';

/**
 * 列表、详情面板与 CSV 导出共用的格式化工具，
 * 保证三处看到的时间、ID 与解码结果完全一致。
 */

/** 信号单位（与详情面板显示一致） */
export const SIGNAL_UNITS: Record<string, string> = {
  EngineRPM: 'rpm',
  VehicleSpeed: 'km/h',
  CoolantTemp: '°C',
  ThrottlePosition: '%',
  EngineLoad: '%'
};

/** 与帧列表相同的时间格式：HH:MM:SS.mmm（本地时区） */
export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour12: false }) +
    '.' + d.getMilliseconds().toString().padStart(3, '0');
}

/** 与帧列表相同的 CAN ID 格式：0x000 大写三位起 */
export function formatHexId(id: number): string {
  return '0x' + id.toString(16).toUpperCase().padStart(3, '0');
}

/** 数值信号统一保留一位小数，与列表/详情面板显示一致 */
export function formatSignalValue(value: number): string {
  return value.toFixed(1);
}

/** 单条解码信号的文本：名称=数值 单位（三处共用） */
export function formatSignalEntry(name: string, value: number): string {
  const unit = SIGNAL_UNITS[name];
  return `${name}=${formatSignalValue(value)}${unit ? ' ' + unit : ''}`;
}

/** 一帧全部解码信号文本，按插入顺序、分号分隔 */
export function formatDecoded(decoded: Record<string, number>): string {
  return Object.entries(decoded)
    .map(([name, value]) => formatSignalEntry(name, value))
    .join('; ');
}

/** CSV 单元格转义：含逗号、引号、换行时用双引号包裹，内部引号双写 */
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/** UTF-8 BOM，保证 Excel 直接打开中文不乱码、列不错位 */
export const CSV_BOM = '\uFEFF';

export const CSV_HEADER = '时间戳,方向,CAN ID,DLC,数据 (Hex),解码信号';

export interface EmptyReason {
  /** 是否为空批次 */
  empty: boolean;
  /** 空批次时写入文件的说明（含一行表头之外的原因行） */
  reasonLine: string | null;
}

/** 解释导出批次为什么是空的 */
export function explainEmpty(totalFrames: number, filterText: string): EmptyReason {
  const filter = filterText.trim();
  if (totalFrames === 0 && !filter) {
    return {
      empty: true,
      reasonLine: '# 导出为空：列表中暂无帧数据（请先点击"开始捕获"接收 CAN 帧）'
    };
  }
  if (totalFrames === 0 && filter) {
    return {
      empty: true,
      reasonLine: `# 导出为空：列表中暂无帧数据，筛选条件"${filter}"命中 0 条`
    };
  }
  return {
    empty: true,
    reasonLine: `# 导出为空：筛选条件"${filter}"未命中任何帧（列表共 ${totalFrames} 条，命中 0 条）`
  };
}

/**
 * 由页面上看到的帧（即筛选后的列表）生成 CSV 文本。
 * 列顺序与表头和页面表格一一对应；空批次保留表头并追加原因说明行。
 */
export function buildCsv(
  frames: CanFrame[],
  totalFrames: number,
  filterText: string
): string {
  const lines: string[] = [];

  if (frames.length === 0) {
    lines.push(explainEmpty(totalFrames, filterText).reasonLine ?? '# 导出为空：没有可导出的帧');
  }

  lines.push(CSV_HEADER);

  for (const f of frames) {
    lines.push([
      formatTimestamp(f.timestamp),
      f.direction,
      formatHexId(f.arbitrationId),
      String(f.dlc),
      csvCell(f.data),
      csvCell(formatDecoded(f.decoded))
    ].join(','));
  }

  return CSV_BOM + lines.join('\r\n') + '\r\n';
}

/** djb2 短哈希，用于生成批次号 */
function hashString(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * 批次号：同一份筛选结果（首尾帧 id + 条数 + 筛选词相同）视为同一批，
 * 同一批重复导出得到相同 batchId，由后端追加序号避免互相覆盖。
 */
export function computeBatchId(frames: CanFrame[], filterText: string): string {
  const first = frames[0]?.id ?? '';
  const last = frames[frames.length - 1]?.id ?? '';
  const key = `${filterText.trim()}|${frames.length}|${first}|${last}`;
  return 'b' + hashString(key);
}
