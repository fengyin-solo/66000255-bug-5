package com.canbus.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.regex.Pattern;

/**
 * 负责把前端导出的 CSV 批次落盘。
 *
 * 关键约定：
 * - 同一批次（batchId 相同）重复导出不会覆盖，文件名依次追加 _2、_3…；
 * - 早先导出的任何文件都不会被本次写入覆盖（找不到空位序号前不写）；
 * - 写入采用临时文件 + 原子 move，避免写出半截文件；
 * - batchId 经过严格白名单校验，杜绝路径穿越。
 */
@Service
public class ExportService {

    /** 批次号只允许字母、数字、下划线、短横线 */
    private static final Pattern SAFE_BATCH_ID = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");
    private static final String PREFIX = "can_frames_";
    private static final String SUFFIX = ".csv";

    private final Path exportDir;

    public ExportService(@Value("${canbus.export.dir:exports}") String exportDir) {
        this.exportDir = Paths.get(exportDir).toAbsolutePath().normalize();
    }

    @PostConstruct
    void init() throws IOException {
        Files.createDirectories(exportDir);
    }

    public Path getExportDir() {
        return exportDir;
    }

    /** 导出结果元数据 */
    public static class SavedExport {
        public final String fileName;
        public final String batchId;
        public final int copy;
        public final long size;

        SavedExport(String fileName, String batchId, int copy, long size) {
            this.fileName = fileName;
            this.batchId = batchId;
            this.copy = copy;
            this.size = size;
        }
    }

    /**
     * 保存一个导出批次。
     *
     * @param batchId 批次号（相同内容/筛选的重复导出使用相同批次号）
     * @param content CSV 全文（UTF-8，可含 BOM）
     * @return 实际保存的文件名等信息
     */
    public synchronized SavedExport save(String batchId, String content) throws IOException {
        if (batchId == null || !SAFE_BATCH_ID.matcher(batchId).matches()) {
            throw new IllegalArgumentException("非法批次号: " + batchId);
        }
        if (content == null || content.isEmpty()) {
            throw new IllegalArgumentException("导出内容为空");
        }

        // 找到第一个尚未被占用的序号：copy=1 无后缀，其后 _2、_3…
        int copy = 1;
        Path target;
        while (true) {
            target = exportDir.resolve(fileNameFor(batchId, copy));
            // 再次防御：解析结果必须仍在导出目录内
            if (!target.getParent().equals(exportDir)) {
                throw new IllegalArgumentException("非法导出路径");
            }
            if (!Files.exists(target)) {
                break;
            }
            copy++;
            if (copy > 1_000_000) {
                throw new IOException("同一批次导出份数异常，已中止");
            }
        }

        // 原子写入：先写临时文件，再 move 到最终位置（不覆盖已存在文件）
        Path tmp = Files.createTempFile(exportDir, ".export-", ".tmp");
        try {
            Files.write(tmp, content.getBytes(StandardCharsets.UTF_8));
            try {
                Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException e) {
                // 某些文件系统不支持原子 move，退化为“不覆盖”的普通 move
                Files.move(tmp, target);
            }
        } catch (IOException | RuntimeException e) {
            Files.deleteIfExists(tmp);
            throw e;
        }

        long size = Files.size(target);
        return new SavedExport(target.getFileName().toString(), batchId, copy, size);
    }

    private String fileNameFor(String batchId, int copy) {
        if (copy == 1) {
            return PREFIX + batchId + SUFFIX;
        }
        return PREFIX + batchId + "_" + copy + SUFFIX;
    }
}
