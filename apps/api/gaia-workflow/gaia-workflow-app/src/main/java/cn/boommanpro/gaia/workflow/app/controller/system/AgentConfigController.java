package cn.boommanpro.gaia.workflow.app.controller.system;

import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentConfig;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentConfigHistory;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGlobalPermission;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGraphEdge;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGraphNode;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentKnowledgeChunk;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentToolDefinition;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentConfigHistoryService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentConfigService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentGlobalPermissionService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentGraphEdgeService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentGraphNodeService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentKnowledgeChunkService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentToolDefinitionService;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Agent 配置中心：在线管理 Prompt / 节点知识文档 / LLM 参数
 */
@Slf4j
@RestController
@RequestMapping("/api/agent/config")
public class AgentConfigController {

    private final AgentConfigService configService;
    private final AgentConfigHistoryService historyService;
    private final AgentKnowledgeChunkService knowledgeChunkService;
    private final AgentGraphNodeService graphNodeService;
    private final AgentGraphEdgeService graphEdgeService;
    private final AgentToolDefinitionService toolDefinitionService;
    private final AgentGlobalPermissionService globalPermissionService;

    public AgentConfigController(AgentConfigService configService,
                                 AgentConfigHistoryService historyService,
                                 AgentKnowledgeChunkService knowledgeChunkService,
                                 AgentGraphNodeService graphNodeService,
                                 AgentGraphEdgeService graphEdgeService,
                                 AgentToolDefinitionService toolDefinitionService,
                                 AgentGlobalPermissionService globalPermissionService) {
        this.configService = configService;
        this.historyService = historyService;
        this.knowledgeChunkService = knowledgeChunkService;
        this.graphNodeService = graphNodeService;
        this.graphEdgeService = graphEdgeService;
        this.toolDefinitionService = toolDefinitionService;
        this.globalPermissionService = globalPermissionService;
    }

    /**
     * 获取全部配置，可按 configType 过滤
     */
    @GetMapping("/list")
    public List<AgentConfig> list(@RequestParam(required = false) String configType) {
        QueryWrapper<AgentConfig> wrapper = new QueryWrapper<>();
        if (configType != null && !configType.isEmpty()) {
            wrapper.eq("config_type", configType);
        }
        wrapper.orderByAsc("id");
        return configService.list(wrapper);
    }

    /**
     * 根据 configKey 获取单个配置
     */
    @GetMapping("/{configKey}")
    public ResponseEntity<AgentConfig> get(@PathVariable String configKey) {
        AgentConfig config = configService.getOne(
            new QueryWrapper<AgentConfig>().eq("config_key", configKey));
        if (config == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(config);
    }

    /**
     * 新增或更新配置。
     * <p>默认行为（applyImmediately=false）：每次保存仅新增一条历史版本，不更新生效版本（主表），
     * 生效版本需在版本管理中手动切换。
     * <p>applyImmediately=true：归档当前内容为历史版本后，立即更新生效版本（主表），用于模型配置等需即时生效的场景。
     * <p>新建（configKey 不存在）：直接写入主表并归档初始版本，不受 applyImmediately 影响。
     */
    @PostMapping("/save")
    public AgentConfig save(@RequestBody AgentConfig config,
                            @RequestParam(defaultValue = "false") boolean applyImmediately) {
        String now = LocalDateTime.now().toString();
        AgentConfig existing = configService.getOne(
            new QueryWrapper<AgentConfig>().eq("config_key", config.getConfigKey()));
        if (existing != null) {
            archiveHistory(config);
            if (applyImmediately) {
                config.setId(existing.getId());
                config.setCreatedAt(existing.getCreatedAt());
                config.setUpdatedAt(now);
                configService.updateById(config);
                log.info("Updated agent config [{}] (applied immediately)", config.getConfigKey());
                return config;
            }
            log.info("Saved new version for agent config [{}] (effective unchanged)", config.getConfigKey());
            return existing;
        } else {
            config.setCreatedAt(now);
            config.setUpdatedAt(now);
            configService.save(config);
            archiveHistory(config);
            log.info("Created agent config [{}]", config.getConfigKey());
            return config;
        }
    }

    /**
     * 软删除配置
     */
    @DeleteMapping("/{configKey}")
    public boolean delete(@PathVariable String configKey) {
        return configService.remove(
            new QueryWrapper<AgentConfig>().eq("config_key", configKey));
    }

    /**
     * 获取配置的历史版本列表
     */
    @GetMapping("/{configKey}/history")
    public List<AgentConfigHistory> history(@PathVariable String configKey) {
        return historyService.list(
            new QueryWrapper<AgentConfigHistory>()
                .eq("config_key", configKey)
                .orderByDesc("version"));
    }

    /**
     * 应用指定历史版本为生效版本（更新主表，不产生新的历史记录）
     */
    @PostMapping("/{configKey}/revert/{version}")
    public ResponseEntity<AgentConfig> revert(@PathVariable String configKey,
                                              @PathVariable Integer version) {
        AgentConfigHistory target = historyService.getOne(
            new QueryWrapper<AgentConfigHistory>()
                .eq("config_key", configKey)
                .eq("version", version));
        if (target == null) {
            return ResponseEntity.notFound().build();
        }
        AgentConfig existing = configService.getOne(
            new QueryWrapper<AgentConfig>().eq("config_key", configKey));
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        existing.setTitle(target.getTitle());
        existing.setContent(target.getContent());
        existing.setConfigData(target.getConfigData());
        existing.setDescription(target.getDescription());
        existing.setUpdatedAt(LocalDateTime.now().toString());
        configService.updateById(existing);
        log.info("Applied version {} as effective for agent config [{}]", version, configKey);
        return ResponseEntity.ok(existing);
    }

    /**
     * 归档当前配置到历史表
     */
    private void archiveHistory(AgentConfig config) {
        List<AgentConfigHistory> histories = historyService.list(
            new QueryWrapper<AgentConfigHistory>()
                .eq("config_key", config.getConfigKey())
                .orderByDesc("version"));
        int nextVersion = histories.isEmpty() ? 1 : histories.get(0).getVersion() + 1;
        AgentConfigHistory history = new AgentConfigHistory();
        history.setConfigKey(config.getConfigKey());
        history.setVersion(nextVersion);
        history.setTitle(config.getTitle());
        history.setContent(config.getContent());
        history.setConfigData(config.getConfigData());
        history.setDescription(config.getDescription());
        history.setChangedBy("system");
        history.setCreatedAt(LocalDateTime.now().toString());
        historyService.save(history);
    }

    // ==================== Export / Import ====================

    /**
     * 导出所有 Agent 配置（configs / knowledgeChunks / graphNodes / graphEdges /
     * toolDefinitions / globalPermissions），以 JSON 文件附件形式下载
     */
    @GetMapping("/export")
    public ResponseEntity<String> exportAll() {
        JSONObject payload = new JSONObject()
            .set("configs", configService.list(new QueryWrapper<AgentConfig>().orderByAsc("id")))
            .set("knowledgeChunks", knowledgeChunkService.list(
                new QueryWrapper<AgentKnowledgeChunk>().orderByAsc("id")))
            .set("graphNodes", graphNodeService.list(
                new QueryWrapper<AgentGraphNode>().orderByAsc("id")))
            .set("graphEdges", graphEdgeService.list(
                new QueryWrapper<AgentGraphEdge>().orderByAsc("id")))
            .set("toolDefinitions", toolDefinitionService.list(
                new QueryWrapper<AgentToolDefinition>().orderByAsc("id")))
            .set("globalPermissions", globalPermissionService.list(
                new QueryWrapper<AgentGlobalPermission>().orderByAsc("id")));

        String body = JSONUtil.toJsonStr(payload);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"agent-config-export.json\"")
            .contentType(MediaType.APPLICATION_JSON)
            .body(body);
    }

    /**
     * 导入 Agent 配置（与导出格式一致），按 key/title 做 upsert，不删除已有数据。
     * 返回导入统计 { configs, knowledge, graphNodes, graphEdges, tools, permissions }
     */
    @PostMapping("/import")
    public JSONObject importAll(@RequestBody String body) {
        JSONObject payload = JSONUtil.parseObj(body);
        int configs = importConfigs(payload.getJSONArray("configs"));
        int knowledge = importKnowledgeChunks(payload.getJSONArray("knowledgeChunks"));
        int graphNodes = importGraphNodes(payload.getJSONArray("graphNodes"));
        int graphEdges = importGraphEdges(payload.getJSONArray("graphEdges"));
        int tools = importToolDefinitions(payload.getJSONArray("toolDefinitions"));
        int permissions = importGlobalPermissions(payload.getJSONArray("globalPermissions"));
        log.info("Agent config import: configs={}, knowledge={}, graphNodes={}, graphEdges={}, tools={}, permissions={}",
            configs, knowledge, graphNodes, graphEdges, tools, permissions);
        return new JSONObject()
            .set("configs", configs)
            .set("knowledge", knowledge)
            .set("graphNodes", graphNodes)
            .set("graphEdges", graphEdges)
            .set("tools", tools)
            .set("permissions", permissions);
    }

    /**
     * 按 configKey upsert，更新前归档历史
     */
    private int importConfigs(JSONArray array) {
        if (array == null || array.isEmpty()) {
            return 0;
        }
        String now = LocalDateTime.now().toString();
        int count = 0;
        for (int i = 0; i < array.size(); i++) {
            JSONObject item = array.getJSONObject(i);
            String configKey = item.getStr("configKey");
            if (configKey == null || configKey.isEmpty()) {
                continue;
            }
            AgentConfig existing = configService.getOne(
                new QueryWrapper<AgentConfig>().eq("config_key", configKey));
            AgentConfig config = JSONUtil.toBean(item, AgentConfig.class);
            if (existing != null) {
                archiveHistory(existing);
                config.setId(existing.getId());
                config.setCreatedAt(existing.getCreatedAt());
                config.setUpdatedAt(now);
                configService.updateById(config);
            } else {
                config.setId(null);
                config.setCreatedAt(now);
                config.setUpdatedAt(now);
                configService.save(config);
            }
            count++;
        }
        return count;
    }

    /**
     * 按 title upsert（agent_knowledge_chunk 无业务唯一键）
     */
    private int importKnowledgeChunks(JSONArray array) {
        if (array == null || array.isEmpty()) {
            return 0;
        }
        String now = LocalDateTime.now().toString();
        int count = 0;
        for (int i = 0; i < array.size(); i++) {
            JSONObject item = array.getJSONObject(i);
            String title = item.getStr("title");
            if (title == null || title.isEmpty()) {
                continue;
            }
            AgentKnowledgeChunk existing = knowledgeChunkService.getOne(
                new QueryWrapper<AgentKnowledgeChunk>().eq("title", title).last("LIMIT 1"));
            AgentKnowledgeChunk chunk = JSONUtil.toBean(item, AgentKnowledgeChunk.class);
            if (existing != null) {
                chunk.setId(existing.getId());
                chunk.setCreatedAt(existing.getCreatedAt());
                chunk.setUpdatedAt(now);
                knowledgeChunkService.updateById(chunk);
            } else {
                chunk.setId(null);
                chunk.setCreatedAt(now);
                chunk.setUpdatedAt(now);
                knowledgeChunkService.save(chunk);
            }
            count++;
        }
        return count;
    }

    /**
     * 按 nodeKey upsert
     */
    private int importGraphNodes(JSONArray array) {
        if (array == null || array.isEmpty()) {
            return 0;
        }
        String now = LocalDateTime.now().toString();
        int count = 0;
        for (int i = 0; i < array.size(); i++) {
            JSONObject item = array.getJSONObject(i);
            String nodeKey = item.getStr("nodeKey");
            if (nodeKey == null || nodeKey.isEmpty()) {
                continue;
            }
            AgentGraphNode existing = graphNodeService.getOne(
                new QueryWrapper<AgentGraphNode>().eq("node_key", nodeKey));
            AgentGraphNode node = JSONUtil.toBean(item, AgentGraphNode.class);
            if (existing != null) {
                node.setId(existing.getId());
                node.setCreatedAt(existing.getCreatedAt());
                node.setUpdatedAt(now);
                graphNodeService.updateById(node);
            } else {
                node.setId(null);
                node.setCreatedAt(now);
                node.setUpdatedAt(now);
                graphNodeService.save(node);
            }
            count++;
        }
        return count;
    }

    /**
     * 按 (sourceKey, targetKey, edgeType) upsert；无匹配则新增
     */
    private int importGraphEdges(JSONArray array) {
        if (array == null || array.isEmpty()) {
            return 0;
        }
        String now = LocalDateTime.now().toString();
        int count = 0;
        for (int i = 0; i < array.size(); i++) {
            JSONObject item = array.getJSONObject(i);
            String sourceKey = item.getStr("sourceKey");
            String targetKey = item.getStr("targetKey");
            String edgeType = item.getStr("edgeType");
            if (sourceKey == null || targetKey == null || edgeType == null) {
                continue;
            }
            AgentGraphEdge existing = graphEdgeService.getOne(
                new QueryWrapper<AgentGraphEdge>()
                    .eq("source_key", sourceKey)
                    .eq("target_key", targetKey)
                    .eq("edge_type", edgeType)
                    .last("LIMIT 1"));
            AgentGraphEdge edge = JSONUtil.toBean(item, AgentGraphEdge.class);
            if (existing != null) {
                edge.setId(existing.getId());
                graphEdgeService.updateById(edge);
            } else {
                edge.setId(null);
                edge.setCreatedAt(now);
                graphEdgeService.save(edge);
            }
            count++;
        }
        return count;
    }

    /**
     * 按 toolName upsert
     */
    private int importToolDefinitions(JSONArray array) {
        if (array == null || array.isEmpty()) {
            return 0;
        }
        String now = LocalDateTime.now().toString();
        int count = 0;
        for (int i = 0; i < array.size(); i++) {
            JSONObject item = array.getJSONObject(i);
            String toolName = item.getStr("toolName");
            if (toolName == null || toolName.isEmpty()) {
                continue;
            }
            AgentToolDefinition existing = toolDefinitionService.getOne(
                new QueryWrapper<AgentToolDefinition>().eq("tool_name", toolName));
            AgentToolDefinition tool = JSONUtil.toBean(item, AgentToolDefinition.class);
            if (existing != null) {
                tool.setId(existing.getId());
                tool.setCreatedAt(existing.getCreatedAt());
                tool.setUpdatedAt(now);
                toolDefinitionService.updateById(tool);
            } else {
                tool.setId(null);
                tool.setCreatedAt(now);
                tool.setUpdatedAt(now);
                toolDefinitionService.save(tool);
            }
            count++;
        }
        return count;
    }

    /**
     * 按 action upsert
     */
    private int importGlobalPermissions(JSONArray array) {
        if (array == null || array.isEmpty()) {
            return 0;
        }
        int count = 0;
        for (int i = 0; i < array.size(); i++) {
            JSONObject item = array.getJSONObject(i);
            String action = item.getStr("action");
            if (action == null || action.isEmpty()) {
                continue;
            }
            AgentGlobalPermission existing = globalPermissionService.getOne(
                new QueryWrapper<AgentGlobalPermission>().eq("action", action));
            AgentGlobalPermission permission = JSONUtil.toBean(item, AgentGlobalPermission.class);
            if (existing != null) {
                permission.setId(existing.getId());
                globalPermissionService.updateById(permission);
            } else {
                permission.setId(null);
                globalPermissionService.save(permission);
            }
            count++;
        }
        return count;
    }
}
