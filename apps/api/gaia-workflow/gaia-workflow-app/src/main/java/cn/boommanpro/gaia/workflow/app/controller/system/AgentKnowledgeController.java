package cn.boommanpro.gaia.workflow.app.controller.system;

import cn.boommanpro.gaia.workflow.app.service.EmbeddingService;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentKnowledgeChunk;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentKnowledgeChunkService;
import cn.hutool.json.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.AbstractMap;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Agent RAG 知识库管理
 */
@Slf4j
@RestController
@RequestMapping("/api/agent/knowledge")
public class AgentKnowledgeController {

    private final AgentKnowledgeChunkService chunkService;
    private final EmbeddingService embeddingService;

    public AgentKnowledgeController(AgentKnowledgeChunkService chunkService,
                                    EmbeddingService embeddingService) {
        this.chunkService = chunkService;
        this.embeddingService = embeddingService;
    }

    /**
     * 列出全部分块，可按关键字过滤（title 或 content LIKE）
     */
    @GetMapping("/list")
    public List<AgentKnowledgeChunk> list(@RequestParam(required = false) String keyword) {
        QueryWrapper<AgentKnowledgeChunk> wrapper = new QueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            String kw = keyword;
            wrapper.and(w -> w.like("title", kw).or().like("content", kw));
        }
        wrapper.orderByDesc("id");
        return chunkService.list(wrapper);
    }

    /**
     * 根据 id 获取分块
     */
    @GetMapping("/{id}")
    public ResponseEntity<AgentKnowledgeChunk> getById(@PathVariable Long id) {
        AgentKnowledgeChunk chunk = chunkService.getById(id);
        if (chunk == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(chunk);
    }

    /**
     * 新增或更新分块，自动生成 embedding
     */
    @PostMapping("/save")
    public AgentKnowledgeChunk save(@RequestBody AgentKnowledgeChunk chunk) {
        double[] vec = embeddingService.embed(chunk.getContent());
        if (vec != null) {
            chunk.setEmbedding(embeddingService.embedToJson(vec));
        } else {
            log.warn("Embedding 服务不可用，分块 [{}] 以 null 向量存储", chunk.getTitle());
            chunk.setEmbedding(null);
        }
        if (chunk.getId() != null) {
            AgentKnowledgeChunk existing = chunkService.getById(chunk.getId());
            if (existing != null) {
                chunk.setCreatedAt(existing.getCreatedAt());
            }
            chunk.setUpdatedAt(LocalDateTime.now().toString());
            chunkService.updateById(chunk);
        } else {
            chunk.setCreatedAt(LocalDateTime.now().toString());
            chunk.setUpdatedAt(LocalDateTime.now().toString());
            chunkService.save(chunk);
        }
        return chunk;
    }

    /**
     * 软删除分块
     */
    @DeleteMapping("/{id}")
    public boolean delete(@PathVariable Long id) {
        return chunkService.removeById(id);
    }

    /**
     * 语义检索：优先向量余弦相似度，服务不可用时回退关键字匹配
     */
    @PostMapping("/search")
    public List<AgentKnowledgeChunk> search(@RequestBody JSONObject body) {
        String query = body.getStr("query");
        int topK = body.getInt("topK", 5);
        String lang = body.getStr("lang");

        double[] queryVec = embeddingService.embed(query);
        if (queryVec != null) {
            QueryWrapper<AgentKnowledgeChunk> vecWrapper = new QueryWrapper<>();
            if (lang != null && !lang.isEmpty()) {
                vecWrapper.eq("language", lang);
            }
            vecWrapper.isNotNull("embedding");
            List<AgentKnowledgeChunk> all = chunkService.list(vecWrapper);
            return all.stream()
                .map(c -> new AbstractMap.SimpleEntry<AgentKnowledgeChunk, Double>(
                    c, cosineSimilarity(queryVec, embeddingService.jsonToEmbedding(c.getEmbedding()))))
                .filter(e -> e.getValue() > 0)
                .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                .limit(topK)
                .map(AbstractMap.SimpleEntry::getKey)
                .collect(Collectors.toList());
        }

        QueryWrapper<AgentKnowledgeChunk> kwWrapper = new QueryWrapper<>();
        if (lang != null && !lang.isEmpty()) {
            kwWrapper.eq("language", lang);
        }
        kwWrapper.and(w -> w.like("title", query).or().like("content", query))
            .last("LIMIT " + topK);
        return chunkService.list(kwWrapper);
    }

    /**
     * 批量重新生成全部分块的 embedding
     */
    @PostMapping("/reembed-all")
    public JSONObject reembedAll() {
        List<AgentKnowledgeChunk> all = chunkService.list(null);
        int total = all.size();

        if (!embeddingService.isAvailable()) {
            return new JSONObject()
                .set("total", total)
                .set("success", 0)
                .set("failed", total)
                .set("error", "embedding service unavailable");
        }

        int success = 0;
        int failed = 0;
        for (AgentKnowledgeChunk c : all) {
            try {
                double[] vec = embeddingService.embed(c.getContent());
                if (vec != null) {
                    c.setEmbedding(embeddingService.embedToJson(vec));
                    c.setUpdatedAt(LocalDateTime.now().toString());
                    chunkService.updateById(c);
                    success++;
                } else {
                    failed++;
                }
            } catch (Exception e) {
                log.warn("重新生成 embedding 失败, chunk id={}: {}", c.getId(), e.getMessage());
                failed++;
            }
        }

        return new JSONObject()
            .set("total", total)
            .set("success", success)
            .set("failed", failed);
    }

    /**
     * 计算两个向量的余弦相似度，零向量或长度不一致时返回 0
     */
    private double cosineSimilarity(double[] a, double[] b) {
        if (a == null || b == null || a.length != b.length || a.length == 0) {
            return 0;
        }
        double dot = 0;
        double normA = 0;
        double normB = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        double denom = Math.sqrt(normA) * Math.sqrt(normB);
        if (denom == 0) {
            return 0;
        }
        return dot / denom;
    }
}
