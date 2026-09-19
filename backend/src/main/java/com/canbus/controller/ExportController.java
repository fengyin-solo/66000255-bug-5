package com.canbus.controller;

import com.canbus.dto.ExportRequest;
import com.canbus.service.ExportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * CSV 导出接口。
 * 文件在服务端落盘：同批次重复导出追加序号、绝不覆盖，
 * 临时性故障（IO/5xx）由前端自动重试。
 */
@RestController
@RequestMapping("/api/exports")
@CrossOrigin(origins = "*")
public class ExportController {

    private final ExportService exportService;

    public ExportController(ExportService exportService) {
        this.exportService = exportService;
    }

    /** POST /api/exports — 保存一批 CSV */
    @PostMapping
    public ResponseEntity<?> create(@RequestBody ExportRequest request) {
        try {
            ExportService.SavedExport saved =
                    exportService.save(request.getBatchId(), request.getContent());

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("fileName", saved.fileName);
            body.put("batchId", saved.batchId);
            body.put("copy", saved.copy);
            body.put("size", saved.size);
            return ResponseEntity.ok(body);
        } catch (IllegalArgumentException e) {
            // 请求内容本身有误（批次号非法/内容空），不应重试
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(err);
        } catch (IOException e) {
            // 磁盘等临时故障，前端可重试
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("error", "导出文件写入失败: " + e.getMessage());
            return ResponseEntity.status(503).body(err);
        }
    }

    /** GET /api/exports — 查看已保存文件（便于确认早先文件未被覆盖） */
    @GetMapping
    public Map<String, Object> list() throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("dir", exportService.getExportDir().toString());

        java.util.List<Map<String, Object>> files = new java.util.ArrayList<>();
        try (java.util.stream.Stream<Path> stream =
                     java.nio.file.Files.list(exportService.getExportDir())) {
            stream.filter(java.nio.file.Files::isRegularFile)
                  .filter(p -> p.getFileName().toString().endsWith(".csv"))
                  .sorted()
                  .forEach(p -> {
                      Map<String, Object> f = new LinkedHashMap<>();
                      f.put("fileName", p.getFileName().toString());
                      try {
                          f.put("size", java.nio.file.Files.size(p));
                      } catch (IOException ignored) {
                      }
                      files.add(f);
                  });
        }
        body.put("files", files);
        return body;
    }
}
