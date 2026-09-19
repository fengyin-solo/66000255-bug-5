/**
 * 帧字段格式化的唯一数据源。
 *
 * 列表、详情面板与 CSV 导出都必须使用这里的函数，保证
 * “页面看到的解码结果”与“导出文件里的内容”逐字一致。
 */
import type { CanFrame } from '../types';

/** 与列表“时间戳”列一致：HH:MM:SS.mmm（本地时区，24 小时制） */
export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return (
    d.toLocaleTimeString('zh-CN', { hour12: false }) +
    '.' +
    d.getMilliseconds().toString().padStart(3, '0')
  );
}

/** 与列表“CAN ID”列一致：0x000 形式的三位以上大写十六进制 */
export function formatHexId(id: number): string {
  return '0x' + id.toString(16).toUpperCase().padStart(3, '0');
}

/** 与列表/详情面板一致：数值统一保留一位小数 */
export function formatSignalValue(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(1)
    : String(value ?? '');
}

const SIGNAL_UNITS: Record<string, string> = {
  EngineRPM: 'rpm',
  VehicleSpeed: 'km/h',
  CoolantTemp: '°C',
  ThrottlePosition: '%',
  EngineLoad: '%'
};

/** 信号单位（仅详情面板展示，CSV 中不附加单位） */
export function getSignalUnit(name: string): string {
  return SIGNAL_UNITS[name] || '';
}

/**
 * 与列表“解码信号”列一致的单行文本，例如：
 * EngineRPM=1234.0; VehicleSpeed=56.0
 */
export function formatDecodedText(decoded: CanFrame['decoded'] | undefined | null): string {
  if (!decoded) return '';
  return Object.entries(decoded)
    .map(([name, value]) => `${name}=${formatSignalValue(value)}`)
    .join('; ');
}
