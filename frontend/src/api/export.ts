import axios, { AxiosError } from 'axios';

/**
 * 导出接口客户端：
 * - 通过 Vite 代理走后端 /api/exports
 * - 网络错误 / 5xx / 超时按指数退避自动重试（默认 3 次）
 * - 4xx 属于请求本身有误，不重试，直接抛出
 */

const client = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export interface ExportRequest {
  batchId: string;
  filter: string;
  totalFrames: number;
  /** CSV 全文（含 UTF-8 BOM 与 CRLF） */
  content: string;
}

export interface ExportResponse {
  /** 后端实际保存的文件名，同一批重复导出会带递增序号 */
  fileName: string;
  batchId: string;
  /** 该批次第几次导出（1 起） */
  copy: number;
  size: number;
}

export class ExportError extends Error {
  /** 是否为可重试的临时性故障（网络、超时、5xx） */
  readonly retriable: boolean;
  readonly cause?: unknown;

  constructor(message: string, retriable: boolean, cause?: unknown) {
    super(message);
    this.name = 'ExportError';
    this.retriable = retriable;
    this.cause = cause;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetriable(error: AxiosError): boolean {
  // 无响应：网络不通、DNS、CORS、超时等
  if (!error.response) return true;
  // 5xx：服务暂时不可用；429：限流
  return error.response.status >= 500 || error.response.status === 429;
}

function describeError(error: AxiosError): string {
  if (error.code === 'ECONNABORTED') return '导出请求超时';
  if (!error.response) {
    return '无法连接导出服务（接口不可用或网络异常）';
  }
  return `导出服务返回错误（HTTP ${error.response.status}）`;
}

/**
 * 提交导出，失败自动重试。
 * @param onAttempt 每次尝试前回调，用于 UI 展示“第 n 次重试”
 */
export async function exportFrames(
  payload: ExportRequest,
  maxAttempts = 3,
  onAttempt?: (attempt: number, maxAttempts: number) => void
): Promise<ExportResponse> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onAttempt?.(attempt, maxAttempts);
    try {
      const { data } = await client.post<ExportResponse>('/exports', payload);
      return data;
    } catch (err) {
      lastError = err;
      const axErr = err as AxiosError;
      if (!isRetriable(axErr) || attempt === maxAttempts) {
        throw new ExportError(describeError(axErr), isRetriable(axErr), err);
      }
      // 指数退避：500ms、1000ms、…，并加入抖动
      const backoff = 500 * Math.pow(2, attempt - 1) + Math.random() * 200;
      await sleep(backoff);
    }
  }

  throw new ExportError('导出失败：已重试多次仍无法完成', true, lastError);
}
