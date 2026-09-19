package com.canbus.model.dto;

import java.util.List;

/**
 * 帧记录导出请求。
 *
 * 行数据全部使用命名字段（而不是按位置排列的数组），服务端严格按列名
 * 写入 CSV，从结构上保证“时间/方向/数据”等列不会发生错位。
 * 字段取值由前端按页面展示格式预渲染，保证列表、详情与文件三者一致。
 */
public record ExportFramesRequest(
        Long generatedAt,
        String reason,
        List<ExportFrameRow> rows
) {
}
