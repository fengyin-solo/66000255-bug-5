package com.canbus.controller;

import com.canbus.model.dto.ExportFramesRequest;
import com.canbus.service.ExportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 帧记录 CSV 导出接口。
 *
 * 前端把当前页面上的这批帧（含筛选结果、已按页面格式渲染）POST 过来，
 * 服务端只负责按列生成文件。接口不可用时前端请求失败并可重试，
 * 由于文件只在请求成功后才在浏览器侧落盘，失败不会覆盖任何历史导出。
 */
@RestController
@RequestMapping("/api/export")
@CrossOrigin(origins = "*")
public class ExportController {

    private static final DateTimeFormatter FILE_STAMP =
            DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private final ExportService exportService;

    public ExportController(ExportService exportService) {
        this.exportService = exportService;
    }

    @PostMapping("/frames")
    public ResponseEntity<byte[]> exportFrames(@RequestBody ExportFramesRequest request) {
        if (request == null || request.rows() == null) {
            return ResponseEntity.badRequest().body("导出请求缺少帧数据".getBytes(StandardCharsets.UTF_8));
        }

        byte[] csv = exportService.buildFramesCsv(request);

        // 服务端给一个默认文件名；前端下载时仍使用自身生成的唯一名，二者不会覆盖
        String serverName = "can_frames_" + LocalDateTime.now().format(FILE_STAMP) + ".csv";
        String encodedName = URLEncoder.encode(serverName, StandardCharsets.UTF_8).replace("+", "%20");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.set(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + serverName + "\"; filename*=UTF-8''" + encodedName);
        headers.setContentLength(csv.length);

        return new ResponseEntity<>(csv, headers, org.springframework.http.HttpStatus.OK);
    }
}
