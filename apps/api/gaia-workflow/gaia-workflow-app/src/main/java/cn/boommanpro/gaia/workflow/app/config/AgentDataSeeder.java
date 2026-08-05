package cn.boommanpro.gaia.workflow.app.config;

import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentConfig;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGraphEdge;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGraphNode;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentKnowledgeChunk;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentConfigService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentGraphEdgeService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentGraphNodeService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentKnowledgeChunkService;
import cn.hutool.core.io.IoUtil;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

/**
 * Agent 静态种子数据初始化器
 *
 * <p>应用启动后幂等灌入内置的系统提示词、节点知识、RAG 知识库与知识图谱数据。
 * 每个分区独立检查数据是否已存在，缺失时才灌入，实现自愈能力：
 * 即使某次启动时数据被误删，下次启动会自动补齐。
 * 使用 {@link ApplicationRunner} 保证在 Spring 完全启动（schema.sql 已执行）后运行。
 */
@Slf4j
@Component
public class AgentDataSeeder implements ApplicationRunner {

    private static final String NODE_KNOWLEDGE_TYPE = "node_knowledge";
    private static final String SYSTEM_PROMPT_TYPE = "system_prompt";

    private static final String SYSTEM_PROMPT_ZH_PATH = "agent/prompt-zh.md";
    private static final String SYSTEM_PROMPT_EN_PATH = "agent/prompt-en.md";
    private static final String NODE_KNOWLEDGE_PATH = "seed/node-knowledge.json";
    private static final String RAG_KNOWLEDGE_PATH = "seed/rag-knowledge.json";
    private static final String KNOWLEDGE_GRAPH_PATH = "seed/knowledge-graph.json";

    private final AgentConfigService configService;
    private final AgentKnowledgeChunkService knowledgeChunkService;
    private final AgentGraphNodeService graphNodeService;
    private final AgentGraphEdgeService graphEdgeService;
    private final AgentProperties properties;

    public AgentDataSeeder(AgentConfigService configService,
                           AgentKnowledgeChunkService knowledgeChunkService,
                           AgentGraphNodeService graphNodeService,
                           AgentGraphEdgeService graphEdgeService,
                           AgentProperties properties) {
        this.configService = configService;
        this.knowledgeChunkService = knowledgeChunkService;
        this.graphNodeService = graphNodeService;
        this.graphEdgeService = graphEdgeService;
        this.properties = properties;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            int modelCount = seedModelConfig();
            int promptCount = seedSystemPrompt();
            int configCount = seedNodeKnowledge();
            int ragCount = seedRagKnowledge();
            int[] graphCounts = seedKnowledgeGraph();
            log.info("Agent seed data check complete: modelConfig={}, systemPrompt={}, nodeKnowledge={}, rag={}, graphNodes={}, graphEdges={}",
                    modelCount, promptCount, configCount, ragCount, graphCounts[0], graphCounts[1]);
        } catch (Exception e) {
            log.warn("Agent seed data initialization failed: {}", e.getMessage(), e);
        }
    }

    /**
     * 灌入模型配置到 agent_config，configKey=llm_config
     * 使用 agent/prompt-zh.md 的 application.yml 默认值初始化，用户可在管理后台修改
     *
     * @return 灌入条数（0 表示已存在跳过）
     */
    private int seedModelConfig() {
        long existing = configService.count(
                new QueryWrapper<AgentConfig>().eq("config_key", "llm_config"));
        if (existing > 0) {
            log.debug("LLM config already exists, skip.");
            return 0;
        }
        JSONObject configData = new JSONObject()
                .set("apiHost", properties.getLlm().getApiHost())
                .set("apiKey", properties.getLlm().getApiKey())
                .set("model", properties.getLlm().getModel())
                .set("temperature", properties.getLlm().getTemperature())
                .set("maxTokens", properties.getLlm().getMaxTokens())
                .set("contextWindow", properties.getLlm().getContextWindow());
        String now = LocalDateTime.now().toString();
        AgentConfig config = new AgentConfig();
        config.setConfigKey("llm_config");
        config.setConfigType("llm_config");
        config.setTitle("LLM 模型配置");
        config.setContent("Agent 对话使用的模型配置，修改后即时生效");
        config.setConfigData(configData.toString());
        config.setDescription("包含 apiHost/apiKey/model/temperature/maxTokens/contextWindow");
        config.setCreatedAt(now);
        config.setUpdatedAt(now);
        configService.save(config);
        log.info("Seeded LLM model config: model={}", properties.getLlm().getModel());
        return 1;
    }

    /**
     * 灌入系统提示词到 agent_config，configKey=system_prompt.default，configType=system_prompt
     *
     * @return 灌入条数（0 表示已存在跳过）
     */
    private int seedSystemPrompt() {
        int count = 0;
        String now = LocalDateTime.now().toString();

        // 中文版 system_prompt.default
        long zhExisting = configService.count(
                new QueryWrapper<AgentConfig>()
                        .eq("config_type", SYSTEM_PROMPT_TYPE)
                        .eq("config_key", "system_prompt.default"));
        if (zhExisting == 0) {
            String content = readResource(SYSTEM_PROMPT_ZH_PATH);
            if (content != null && !content.isEmpty()) {
                AgentConfig config = new AgentConfig();
                config.setConfigKey("system_prompt.default");
                config.setConfigType(SYSTEM_PROMPT_TYPE);
                config.setTitle("Agent 默认系统提示词（中文）");
                config.setContent(content);
                config.setDescription("从 agent/prompt-zh.md 导入");
                config.setCreatedAt(now);
                config.setUpdatedAt(now);
                configService.save(config);
                log.info("Seeded zh-CN system prompt");
                count++;
            }
        }

        // 英文版 system_prompt.default.en
        long enExisting = configService.count(
                new QueryWrapper<AgentConfig>()
                        .eq("config_type", SYSTEM_PROMPT_TYPE)
                        .eq("config_key", "system_prompt.default.en"));
        if (enExisting == 0) {
            String content = readResource(SYSTEM_PROMPT_EN_PATH);
            if (content != null && !content.isEmpty()) {
                AgentConfig config = new AgentConfig();
                config.setConfigKey("system_prompt.default.en");
                config.setConfigType(SYSTEM_PROMPT_TYPE);
                config.setTitle("Agent Default System Prompt (English)");
                config.setContent(content);
                config.setDescription("Imported from agent/prompt-en.md");
                config.setCreatedAt(now);
                config.setUpdatedAt(now);
                configService.save(config);
                log.info("Seeded en-US system prompt");
                count++;
            }
        }

        return count;
    }

    /**
     * 灌入节点知识文档到 agent_config，configKey=node_{nodeType}，configType=node_knowledge
     *
     * @return 灌入条数（0 表示已存在跳过）
     */
    private int seedNodeKnowledge() {
        long existing = configService.count(
                new QueryWrapper<AgentConfig>().eq("config_type", NODE_KNOWLEDGE_TYPE));
        if (existing > 0) {
            log.debug("Node knowledge configs already exist ({}), skip.", existing);
            return 0;
        }
        JSONArray array = readJsonArray(NODE_KNOWLEDGE_PATH);
        if (array == null || array.isEmpty()) {
            log.warn("Node knowledge seed file is empty: {}", NODE_KNOWLEDGE_PATH);
            return 0;
        }
        String now = LocalDateTime.now().toString();
        int count = 0;
        for (int i = 0; i < array.size(); i++) {
            JSONObject item = array.getJSONObject(i);
            String nodeType = item.getStr("nodeType");
            String title = item.getStr("title");
            String content = item.getStr("content");
            if (nodeType == null || nodeType.isEmpty()) {
                continue;
            }
            String configKey = "node_" + nodeType;
            AgentConfig config = new AgentConfig();
            config.setConfigKey(configKey);
            config.setConfigType(NODE_KNOWLEDGE_TYPE);
            config.setTitle(title);
            config.setContent(content);
            config.setDescription("Flowgram 节点知识文档: " + nodeType);
            config.setCreatedAt(now);
            config.setUpdatedAt(now);
            configService.save(config);
            count++;
        }
        log.info("Seeded {} node knowledge configs", count);
        return count;
    }

    /**
     * 灌入 RAG 知识库到 agent_knowledge_chunk，embedding=null（降级为关键词匹配）
     *
     * @return 灌入条数（0 表示已存在跳过）
     */
    private int seedRagKnowledge() {
        long existing = knowledgeChunkService.count(new QueryWrapper<>());
        if (existing > 0) {
            log.debug("RAG knowledge chunks already exist ({}), skip.", existing);
            return 0;
        }
        JSONArray array = readJsonArray(RAG_KNOWLEDGE_PATH);
        if (array == null || array.isEmpty()) {
            log.warn("RAG knowledge seed file is empty: {}", RAG_KNOWLEDGE_PATH);
            return 0;
        }
        String now = LocalDateTime.now().toString();
        int count = 0;
        for (int i = 0; i < array.size(); i++) {
            JSONObject item = array.getJSONObject(i);
            String title = item.getStr("title");
            String content = item.getStr("content");
            if (title == null || content == null) {
                continue;
            }
            AgentKnowledgeChunk chunk = new AgentKnowledgeChunk();
            chunk.setTitle(title);
            chunk.setContent(content);
            chunk.setEmbedding(null);
            chunk.setSource(item.getStr("source", "seed"));
            chunk.setMetadata(null);
            chunk.setCreatedAt(now);
            chunk.setUpdatedAt(now);
            knowledgeChunkService.save(chunk);
            count++;
        }
        log.info("Seeded {} RAG knowledge chunks", count);
        return count;
    }

    /**
     * 灌入知识图谱节点与边，description 存入 properties JSON
     *
     * @return [节点数, 边数]（0 表示已存在跳过）
     */
    private int[] seedKnowledgeGraph() {
        long existingNodes = graphNodeService.count(new QueryWrapper<>());
        if (existingNodes > 0) {
            log.debug("Knowledge graph nodes already exist ({}), skip.", existingNodes);
            return new int[]{0, 0};
        }
        JSONObject root = readJsonObject(KNOWLEDGE_GRAPH_PATH);
        if (root == null) {
            log.warn("Knowledge graph seed file is empty: {}", KNOWLEDGE_GRAPH_PATH);
            return new int[]{0, 0};
        }
        String now = LocalDateTime.now().toString();
        int nodeCount = 0;
        JSONArray nodes = root.getJSONArray("nodes");
        if (nodes != null) {
            for (int i = 0; i < nodes.size(); i++) {
                JSONObject item = nodes.getJSONObject(i);
                String nodeKey = item.getStr("nodeKey");
                String nodeType = item.getStr("nodeType");
                String title = item.getStr("title");
                if (nodeKey == null || nodeKey.isEmpty()) {
                    continue;
                }
                AgentGraphNode node = new AgentGraphNode();
                node.setNodeKey(nodeKey);
                node.setNodeType(nodeType);
                node.setTitle(title);
                node.setProperties(buildProperties(item.getStr("description")));
                node.setCreatedAt(now);
                node.setUpdatedAt(now);
                graphNodeService.save(node);
                nodeCount++;
            }
        }

        int edgeCount = 0;
        JSONArray edges = root.getJSONArray("edges");
        if (edges != null) {
            for (int i = 0; i < edges.size(); i++) {
                JSONObject item = edges.getJSONObject(i);
                String sourceKey = item.getStr("sourceKey");
                String targetKey = item.getStr("targetKey");
                String edgeType = item.getStr("edgeType");
                if (sourceKey == null || targetKey == null || edgeType == null) {
                    continue;
                }
                AgentGraphEdge edge = new AgentGraphEdge();
                edge.setSourceKey(sourceKey);
                edge.setTargetKey(targetKey);
                edge.setEdgeType(edgeType);
                edge.setCreatedAt(now);
                graphEdgeService.save(edge);
                edgeCount++;
            }
        }
        log.info("Seeded knowledge graph: nodes={}, edges={}", nodeCount, edgeCount);
        return new int[]{nodeCount, edgeCount};
    }

    /**
     * 将 description 封装为 properties JSON 字符串，便于后续扩展
     */
    private String buildProperties(String description) {
        if (description == null || description.isEmpty()) {
            return null;
        }
        return new JSONObject().set("description", description).toString();
    }

    /**
     * 读取 classpath 下的 JSON 数组资源
     */
    private JSONArray readJsonArray(String path) {
        String text = readResource(path);
        if (text == null || text.isEmpty()) {
            return null;
        }
        return JSONUtil.parseArray(text);
    }

    /**
     * 读取 classpath 下的 JSON 对象资源
     */
    private JSONObject readJsonObject(String path) {
        String text = readResource(path);
        if (text == null || text.isEmpty()) {
            return null;
        }
        return JSONUtil.parseObj(text);
    }

    /**
     * 通过 ClassLoader 读取 classpath 资源为 UTF-8 字符串
     */
    private String readResource(String path) {
        try (InputStream is = getClass().getClassLoader().getResourceAsStream(path)) {
            if (is == null) {
                log.warn("Seed resource not found: {}", path);
                return null;
            }
            return IoUtil.read(is, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("Failed to read seed resource {}: {}", path, e.getMessage());
            return null;
        }
    }
}
