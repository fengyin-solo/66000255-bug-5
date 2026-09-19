package com.canbus.service;

import com.canbus.model.dto.ExportFrameRow;
import com.canbus.model.dto.ExportFramesRequest;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 将前端按页面格式预渲染好的帧记录生成为 CSV。
 *
 * 关键约定：
 * - 表头使用中文列名，与页面表格各列严格对应；
 * - 每个字段经 {@link #csvCell} 单独转义，并严格按命名属性取列，杜绝错位；
 * - 空批次（rows 为空）时除表头外写入原因行，说明文件为什么是空的；
 * - 文件以 UTF-8 BOM 开头，保证 Excel 直接打开中文不乱码。
 */
@Service
public class ExportService {

    private static final char UTF8_BOM = '﻿';

    private static final String[] HEADERS = {
            "时间戳", "方向", "CAN_ID", "DLC", "数据 (Hex)", "解码信号"
    };

    private static final DateTimeFormatter FILE_TIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public byte[] buildFramesCsv(ExportFramesRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append(UTF8_BOM); // UTF-8 BOM（U+FEFF），便于 Excel 识别编码
        sb.append(String.join(",", HEADERS)).append("\r\n");

        List<ExportFrameRow> rows = request.rows() == null ? List.of() : request.rows();

        if (rows.isEmpty()) {
            String reason = request.reason() == null || request.reason().isBlank()
                    ? "本批次没有可导出的帧记录"
                    : request.reason();
            // 原因写入第一格并整体转义，其余列留空，保持六列结构
            sb.append(csvCell("# 导出为空：" + reason)).append(",,,,,\r\n");
            sb.append(csvCell("# 导出时间：" + LocalDateTime.now().format(FILE_TIME)))
                    .append(",,,,,\r\n");
            sb.append(csvCell("# 导出记录数：0")).append(",,,,,\r\n");
        } else {
            for (ExportFrameRow row : rows) {
                sb.append(csvCell(row.timestamp())).append(',')
                        .append(csvCell(row.direction())).append(',')
                        .append(csvCell(row.canId())).append(',')
                        .append(csvCell(row.dlc() == null ? "" : row.dlc().toString())).append(',')
                        .append(csvCell(row.data())).append(',')
                        .append(csvCell(row.decoded()))
                        .append("\r\n");
            }
        }

        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    /**
     * RFC 4180 风格的单元格转义：含逗号、引号或换行时用双引号包裹，
     * 内部双引号翻倍。这样数据/解码文本中的分隔符不会冲乱列结构。
     */
    private String csvCell(String value) {
        if (value == null) {
            return "";
        }
        boolean needQuote = value.contains(",") || value.contains("\"")
                || value.contains("\n") || value.contains("\r");
        if (!needQuote) {
            return value;
        }
        return '"' + value.replace("\"", "\"\"") + '"';
    }
}
