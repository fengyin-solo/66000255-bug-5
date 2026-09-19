<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { useCanBusStore } from './store/canbus';
import FrameTable from './components/FrameTable.vue';
import SignalChart from './components/SignalChart.vue';
import {
  buildExportSnapshot,
  exportFramesToServer,
  generateExportFilename,
  saveBlobAs,
  type ExportError,
  type ExportFramesPayload
} from './utils/export';

const store = useCanBusStore();

function handleLoadDbc() {
  store.loadMockDbc();
  alert(`已加载 DBC 定义: ${store.dbcMessages.size} 条消息`);
}

// ---- 导出状态 ----
const isExporting = ref(false);
const exportError = ref<string | null>(null);
let exportSnapshot: ExportFramesPayload | null = null;
let abortController: AbortController | null = null;
let successTimer: ReturnType<typeof setTimeout> | null = null;
const successMessage = ref<string | null>(null);

/**
 * 执行一次导出。无论成功失败都复用同一快照：
 * - 快照在首次点击时按当前 filteredFrames 定格，重试导出的仍是同一批；
 * - 成功才生成唯一文件名并落盘，失败/取消不产生任何文件，早先导出不受影响。
 */
async function runExport(snapshot: ExportFramesPayload) {
  isExporting.value = true;
  exportError.value = null;
  abortController = new AbortController();

  try {
    const blob = await exportFramesToServer(snapshot, abortController.signal);
    // 只有到这里（接口已成功）才生成文件名并写入磁盘
    const filename = generateExportFilename(snapshot.generatedAt);
    saveBlobAs(blob, filename);

    if (snapshot.rows.length === 0) {
      successMessage.value = '导出完成：本批次为空，原因已写入文件';
    } else {
      successMessage.value = `导出成功：${snapshot.rows.length} 条记录 → ${filename}`;
    }
    if (successTimer) clearTimeout(successTimer);
    successTimer = setTimeout(() => (successMessage.value = null), 5000);
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'ExportError'
        ? (err as ExportError).message
        : '导出失败，请重试';
    exportError.value = message;
  } finally {
    isExporting.value = false;
    abortController = null;
  }
}

/** 点击“导出CSV”：定格当前页面上的这批帧 */
function handleExport() {
  if (isExporting.value) return;
  exportSnapshot = buildExportSnapshot(
    store.filteredFrames,
    store.frames.length,
    store.filterText,
    store.filterId
  );
  runExport(exportSnapshot);
}

/** 接口不可用/超时时重试同一批快照 */
function retryExport() {
  if (exportSnapshot) runExport(exportSnapshot);
}

/** 失败对话框点击“取消”：仅关闭弹窗（请求此时已经结束） */
function closeErrorDialog() {
  exportError.value = null;
}

function dismissError() {
  if (!isExporting.value) exportError.value = null;
}

onBeforeUnmount(() => {
  abortController?.abort();
  if (successTimer) clearTimeout(successTimer);
});
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-900 text-gray-100 overflow-hidden">
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>
        <h1 class="text-lg font-bold text-gray-100">CAN 总线数据帧解析与诊断仪</h1>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="handleLoadDbc"
          class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded transition-colors border border-gray-600"
        >
          加载DBC
        </button>
        <button
          @click="store.isCapturing ? store.stopCapture() : store.startCapture()"
          class="px-3 py-1.5 text-sm rounded transition-colors font-medium"
          :class="store.isCapturing
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-green-600 hover:bg-green-700 text-white'"
        >
          {{ store.isCapturing ? '停止捕获' : '开始捕获' }}
        </button>
        <button
          @click="store.clearFrames()"
          class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded transition-colors border border-gray-600"
        >
          清除
        </button>
        <button
          @click="handleExport"
          :disabled="isExporting"
          class="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors border border-cyan-600"
        >
          {{ isExporting ? '导出中…' : '导出CSV' }}
        </button>
      </div>
    </header>

    <!-- Main Area -->
    <main class="flex-1 flex overflow-hidden">
      <!-- Left Panel: Frame Table (60%) -->
      <div class="w-3/5 border-r border-gray-700 flex flex-col overflow-hidden">
        <FrameTable />
      </div>

      <!-- Right Panel: Signal Chart (40%) -->
      <div class="w-2/5 flex flex-col overflow-hidden">
        <SignalChart />
      </div>
    </main>

    <!-- Status Bar -->
    <footer class="flex items-center justify-between px-6 py-1.5 bg-gray-800 border-t border-gray-700 text-xs shrink-0">
      <div class="flex items-center gap-4 text-gray-500">
        <span>
          <span :class="store.isCapturing ? 'text-green-400' : 'text-gray-500'">
            ● {{ store.isCapturing ? '捕获中' : '已停止' }}
          </span>
        </span>
        <span>DBC消息: {{ store.dbcMessages.size }}</span>
      </div>
      <div class="flex items-center gap-4 text-gray-500">
        <span>帧数: {{ store.busStats.totalFrames }}</span>
        <span>RX: {{ store.busStats.rxCount }}</span>
        <span>TX: {{ store.busStats.txCount }}</span>
        <span>负载: {{ store.busLoadPercent }}%</span>
      </div>
    </footer>

    <!-- 导出成功提示（自动消失） -->
    <div
      v-if="successMessage"
      class="fixed bottom-12 right-6 z-50 max-w-md px-4 py-3 rounded-lg shadow-lg border text-sm flex items-start gap-2 bg-green-900/95 border-green-600 text-green-100"
    >
      <svg class="w-4 h-4 mt-0.5 shrink-0 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span>{{ successMessage }}</span>
    </div>

    <!-- 导出失败对话框：可重试同一批 / 取消（不产生任何文件） -->
    <div
      v-if="exportError"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      @click.self="dismissError"
    >
      <div class="w-full max-w-md mx-4 bg-gray-800 border border-red-700 rounded-lg shadow-xl overflow-hidden">
        <div class="flex items-center gap-2 px-5 py-3 border-b border-gray-700 bg-red-950/40">
          <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
          </svg>
          <h2 class="text-sm font-semibold text-red-200">导出失败</h2>
        </div>
        <div class="px-5 py-4">
          <p class="text-sm text-gray-300">{{ exportError }}</p>
          <p class="mt-2 text-xs text-gray-500">
            本次未生成任何文件，早先导出的文件不会受影响。接口恢复后可直接重试，仍导出同一批记录。
          </p>
        </div>
        <div class="flex justify-end gap-2 px-5 py-3 bg-gray-900/50">
          <button
            @click="closeErrorDialog"
            class="px-3 py-1.5 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            @click="retryExport"
            class="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
          >
            重试导出
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
