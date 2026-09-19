<script setup lang="ts">
import { useCanBusStore } from './store/canbus';
import FrameTable from './components/FrameTable.vue';
import SignalChart from './components/SignalChart.vue';

const store = useCanBusStore();

function handleLoadDbc() {
  store.loadMockDbc();
  alert(`已加载 DBC 定义: ${store.dbcMessages.size} 条消息`);
}

async function handleExport() {
  try {
    await store.exportFrames();
  } catch {
    // 错误信息已写入 store.exportMessage，由页面上的状态条展示并可重试
  }
}
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
          :disabled="store.exportState === 'working'"
          class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 text-sm rounded transition-colors border border-gray-600"
        >
          {{ store.exportState === 'working' ? '导出中…' : '导出CSV' }}
        </button>
      </div>
    </header>

    <!-- Export status bar -->
    <div
      v-if="store.exportState !== 'idle'"
      class="px-6 py-1.5 text-xs flex items-center justify-between shrink-0 border-b"
      :class="{
        'bg-cyan-950/60 border-cyan-800 text-cyan-300': store.exportState === 'working',
        'bg-green-950/60 border-green-800 text-green-300': store.exportState === 'success',
        'bg-red-950/60 border-red-800 text-red-300': store.exportState === 'error'
      }"
    >
      <span>
        <span v-if="store.exportState === 'working'" class="animate-pulse">● </span>
        {{ store.exportMessage }}
      </span>
      <span class="flex items-center gap-3">
        <button
          v-if="store.exportState === 'error'"
          @click="handleExport"
          class="px-2 py-0.5 bg-red-800 hover:bg-red-700 text-white rounded font-medium"
        >
          重试导出
        </button>
        <button
          v-if="store.exportState !== 'working'"
          @click="store.resetExportStatus()"
          class="text-gray-400 hover:text-gray-200"
        >
          ✕
        </button>
      </span>
    </div>

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
  </div>
</template>
