package com.canbus.model.dto;

/**
 * 导出文件中的一行帧记录，字段顺序与 CSV 表头一一对应。
 */
public record ExportFrameRow(
        String timestamp,
        String direction,
        String canId,
        Integer dlc,
        String data,
        String decoded
) {
}
