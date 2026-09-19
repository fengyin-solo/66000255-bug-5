/**
 * 帧记录 CSV 导出：把“当前页面上这批帧”（含筛选结果）发送给后端生成文件。
 *
 * 设计要点：
 * - 导出的是 filteredFrames 快照，而不是 store 全量，保证文件与列表一致；
 * - 时间、CAN ID、解码文本都经过 frame-format 预渲染，后端只做 CSV 转义，
 *   因此列表/详情/导出三处取值完全相同；
 * - 行数据按命名字段传输（非位置数组），后端按列名写入，结构上杜绝列错位；
 * - 只有 HTTP 成功才返回 Blob，失败抛出 ExportError，调用方据此重试且不会落盘；
 * - 文件名带时间戳 + 单调递增序号 + 随机串，同一批重复导出不会互相覆盖。
 */
import type { CanFrame } from '../types';
import {
  formatTimestamp,
  formatHexId,
  formatDecodedText
} from './frame-format';

export interface ExportFrameRow {
  timestamp: string;
  direction: string;
  canId: string;
  dlc: number;
  data: string;
  decoded: string;
}

export interface ExportFramesPayload {
  generatedAt: number;
  reason: string | null;
  rows: ExportFrameRow[];
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  rowCount: number;
  empty: boolean;
  reason: string | null;
}

export class ExportError extends Error {
  /** 是否为网络/接口不可用类错误（值得提示用户重试） */
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'ExportError';
    this.retryable = retryable;
  }
}

/** 将页面上的一条帧转换为导出行，字段取值与表格各列一一对应 */
export function buildExportRow(frame: CanFrame): ExportFrameRow {
  return {
    timestamp: formatTimestamp(frame.timestamp),
    direction: frame.direction,
    canId: formatHexId(frame.arbitrationId),
    dlc: frame.dlc,
    data: frame.data,
    decoded: formatDecodedText(frame.decoded)
  };
}

/**
 * 空批次原因。必须区分两种情形：
 * - 一条帧都没有捕获到；
 * - 当前搜索/过滤条件一条都没命中（文件里要写清原因）。
 */
export function buildEmptyReason(
  totalCount: number,
  filterText: string,
  filterId: string
): string {
  const activeFilters: string[] = [];
  const text = filterText.trim();
  const id = filterId.trim();
  if (text) activeFilters.push(`搜索关键字="${text}"`);
  if (id) activeFilters.push(`CAN ID 过滤="${id}"`);

  if (totalCount === 0) {
    return '当前没有任何已捕获的帧记录（请先点击“开始捕获”接收 CAN 帧）';
  }
  const suffix = activeFilters.length > 0 ? `，筛选条件：${activeFilters.join('，')}` : '';
  return `共有 ${totalCount} 条帧记录，但当前筛选条件下没有命中任何记录${suffix}`;
}

/** 构建一次导出的请求快照；重试时复用同一快照，保证内容是同一批 */
export function buildExportSnapshot(
  framesToExport: CanFrame[],
  totalCount: number,
  filterText: string,
  filterId: string
): ExportFramesPayload {
  return {
    generatedAt: Date.now(),
    reason:
      framesToExport.length === 0
        ? buildEmptyReason(totalCount, filterText, filterId)
        : null,
    rows: framesToExport.map(buildExportRow)
  };
}

let filenameSequence = 0;

/** 生成在毫秒内也不会冲突的文件名，早先导出的文件不会被本次覆盖 */
export function generateExportFilename(now: number = Date.now()): string {
  filenameSequence += 1;
  const d = new Date(now);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${pad(d.getMilliseconds(), 3)}`;
  const random = Math.random().toString(36).slice(2, 8);
  return `can_frames_${stamp}_${filenameSequence}_${random}.csv`;
}

/**
 * 调用后端导出接口，成功返回文件内容；接口不可用/超时/返回错误状态时
 * 抛出可重试的 ExportError，不会产生任何本地文件。
 */
export async function exportFramesToServer(
  payload: ExportFramesPayload,
  signal?: AbortSignal
): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch('/api/export/frames', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    });
  } catch (err) {
    if (signal?.aborted) {
      throw new ExportError('导出已取消', false);
    }
    throw new ExportError(
      '无法连接导出服务，接口可能不可用，请确认后端已启动后重试',
      true
    );
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).trim();
    } catch {
      // 忽略错误体读取失败
    }
    throw new ExportError(
      `导出失败（HTTP ${response.status}）${detail ? `：${detail}` : ''}`,
      response.status >= 500
    );
  }

  return response.blob();
}

/**
 * 仅在接口成功返回后调用：触发浏览器“另存为”下载。
 * 早先/后续导出因文件名唯一而不会互相覆盖。
 */
export function saveBlobAs(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 延迟回收，避免部分浏览器在 click 后尚未开始读取就被撤销
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
