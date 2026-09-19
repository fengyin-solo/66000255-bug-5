package com.canbus.dto;

/**
 * 导出请求体：
 * batchId     批次号（同一份列表+筛选的重复导出相同，用于追加序号而非覆盖）
 * filter      当前筛选文本（用于服务端留痕，可为空）
 * totalFrames 本次导出的帧数（空批次为 0）
 * content     CSV 全文（UTF-8，含表头；空批次含原因说明行）
 */
public class ExportRequest {
    private String batchId;
    private String filter;
    private int totalFrames;
    private String content;

    public String getBatchId() { return batchId; }
    public void setBatchId(String batchId) { this.batchId = batchId; }

    public String getFilter() { return filter; }
    public void setFilter(String filter) { this.filter = filter; }

    public int getTotalFrames() { return totalFrames; }
    public void setTotalFrames(int totalFrames) { this.totalFrames = totalFrames; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}
