package cn.boommanpro.gaia.workflow.app.service;

import cn.boommanpro.gaia.workflow.app.config.AgentProperties;
import cn.boommanpro.gaia.workflow.app.domain.agent.input.ChatInput;
import cn.boommanpro.gaia.workflow.app.domain.agent.input.ToolResultInput;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGlobalPermission;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGraphNode;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGraphEdge;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentKnowledgeChunk;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentMessage;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentPermission;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentSession;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentGlobalPermissionService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentGraphEdgeService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentGraphNodeService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentKnowledgeChunkService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentMessageService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentPermissionService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentSessionService;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.annotation.PreDestroy;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.AbstractMap;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Agent 对话编排服务
 * 负责：保存消息、加载历史、调 LLM（SSE 流式）、透传 token、处理 tool_calls 权限
 *
 * <p>每次对话会加载以下上下文并在日志和 SSE debug 事件中清晰记录：
 * <ul>
 *   <li>系统提示词（从 agent_config DB 或 classpath 资源）</li>
 *   <li>RAG 知识库（向量检索或关键词匹配 top 3）</li>
 *   <li>知识图谱（按关键词子图检索）</li>
 *   <li>工具定义（从 agent_tool_definition DB）</li>
 *   <li>历史消息（最近 N 条，user 边界截断）</li>
 * </ul>
 */
@Slf4j
@Service
public class AgentChatService {

    private final AgentMessageService messageService;
    private final AgentPermissionService permissionService;
    private final AgentGlobalPermissionService globalPermissionService;
    private final AgentKnowledgeChunkService knowledgeChunkService;
    private final AgentGraphNodeService graphNodeService;
    private final AgentGraphEdgeService graphEdgeService;
    private final EmbeddingService embeddingService;
    private final AgentToolRegistry toolRegistry;
    private final AgentProperties properties;
    private final AgentModelConfigService modelConfigService;
    private final AgentSessionService sessionService;

    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "agent-chat");
        t.setDaemon(true);
        return t;
    });

    public AgentChatService(AgentMessageService messageService,
                            AgentPermissionService permissionService,
                            AgentGlobalPermissionService globalPermissionService,
                            AgentKnowledgeChunkService knowledgeChunkService,
                            AgentGraphNodeService graphNodeService,
                            AgentGraphEdgeService graphEdgeService,
                            EmbeddingService embeddingService,
                            AgentToolRegistry toolRegistry,
                            AgentProperties properties,
                            AgentModelConfigService modelConfigService,
                            AgentSessionService sessionService) {
        this.messageService = messageService;
        this.permissionService = permissionService;
        this.globalPermissionService = globalPermissionService;
        this.knowledgeChunkService = knowledgeChunkService;
        this.graphNodeService = graphNodeService;
        this.graphEdgeService = graphEdgeService;
        this.embeddingService = embeddingService;
        this.toolRegistry = toolRegistry;
        this.properties = properties;
        this.modelConfigService = modelConfigService;
        this.sessionService = sessionService;
    }

    @PreDestroy
    public void destroy() {
        executor.shutdown();
    }

    /**
     * 对话入口（SSE）
     */
    public void chat(SseEmitter emitter, ChatInput input) {
        executor.execute(() -> {
            try {
                String sessionKey = input.getSessionKey();
                String userMessage = input.getMessage();

                // 1. 保存 user 消息（含多模态图片）
                saveMessage(sessionKey, "user", userMessage,
                    null, null, input.getPageContext(), input.getImages());

                // 2. 如果是会话第一条消息，异步生成标题
                tryAutoGenerateTitle(sessionKey, userMessage);

                // 3. 流式调 LLM
                streamLlm(emitter, sessionKey, input.getLocale(), input.getPageContext());
                emitter.send(SseEmitter.event().name("done").data("{}"));
                emitter.complete();
            } catch (Exception e) {
                log.error("Agent chat error", e);
                sendError(emitter, e.getMessage());
            }
        });
    }

    /**
     * 工具结果回灌后继续对话（SSE）
     */
    public void toolResult(SseEmitter emitter, ToolResultInput input) {
        executor.execute(() -> {
            try {
                // 1. 保存所有 tool 消息
                for (ToolResultInput.ResultItem item : input.getResults()) {
                    String content = item.isRejected()
                        ? "{\"error\":\"user rejected\"}"
                        : (item.getResult() != null ? item.getResult() : "{}");
                    saveMessage(input.getSessionKey(), "tool", content, null, item.getToolCallId(), null, null);
                }
                // 2. 流式调 LLM
                streamLlm(emitter, input.getSessionKey(), input.getLocale(), null);
                emitter.send(SseEmitter.event().name("done").data("{}"));
                emitter.complete();
            } catch (Exception e) {
                log.error("Agent toolResult error", e);
                sendError(emitter, e.getMessage());
            }
        });
    }

    /**
     * 压缩会话历史：保留最近 max/2 条，其余调 LLM 摘要后替换为一条 system 消息（SSE）
     */
    public void compact(SseEmitter emitter, String sessionKey) {
        executor.execute(() -> {
            try {
                List<AgentMessage> allMsgs = messageService.list(
                    new QueryWrapper<AgentMessage>().eq("session_key", sessionKey).orderByAsc("id"));
                int max = properties.getHistory().getMaxMessages();
                if (allMsgs.size() <= max) {
                    emitter.send(SseEmitter.event().name("done").data(
                        new JSONObject().set("message", "No compaction needed").toString()));
                    emitter.complete();
                    return;
                }
                int keepCount = max / 2;
                List<AgentMessage> toSummarize = allMsgs.subList(0, allMsgs.size() - keepCount);
                List<AgentMessage> toKeep = allMsgs.subList(allMsgs.size() - keepCount, allMsgs.size());

                StringBuilder summaryText = new StringBuilder();
                for (AgentMessage m : toSummarize) {
                    summaryText.append(m.getRole()).append(": ")
                        .append(m.getContent() != null ? m.getContent() : "").append("\n");
                }

                String summary = summarizeWithLlm(summaryText.toString());

                for (AgentMessage m : toSummarize) {
                    messageService.removeById(m.getId());
                }

                saveMessage(sessionKey, "system", "对话历史摘要:\n" + summary, null, null, null, null);

                emitter.send(SseEmitter.event().name("done").data(
                    new JSONObject()
                        .set("message", "Compacted")
                        .set("removed", toSummarize.size())
                        .set("kept", toKeep.size())
                        .toString()));
                emitter.complete();
            } catch (Exception e) {
                log.error("Compact error", e);
                sendError(emitter, e.getMessage());
            }
        });
    }

    /**
     * 非流式 LLM 调用，用于摘要对话历史
     */
    private String summarizeWithLlm(String text) throws Exception {
        AgentModelConfigService.LlmConfig cfg = modelConfigService.getLlmConfig();
        JSONArray messagesArr = new JSONArray();
        messagesArr.add(new JSONObject().set("role", "system").set("content", "请将以下对话历史压缩为简洁的摘要，保留关键信息和上下文。"));
        messagesArr.add(new JSONObject().set("role", "user").set("content", text));
        JSONObject body = new JSONObject()
            .set("model", cfg.getModel())
            .set("temperature", 0.3)
            .set("messages", messagesArr)
            .set("max_tokens", 500);

        String url = cfg.getApiHost();
        if (!url.endsWith("/")) url += "/";
        url += "chat/completions";

        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + cfg.getApiKey());
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(60000);
        conn.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));

        if (conn.getResponseCode() != 200) {
            throw new RuntimeException("LLM summary failed: " + conn.getResponseCode());
        }
        String resp = readAll(conn.getInputStream());
        JSONObject respJson = JSONUtil.parseObj(resp);
        return respJson.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getStr("content");
    }

    /**
     * 如果会话标题还是默认的"新对话"，用 LLM 根据首条用户消息生成简短标题
     */
    private void tryAutoGenerateTitle(String sessionKey, String userMessage) {
        try {
            AgentSession session = sessionService.getOne(
                new QueryWrapper<AgentSession>().eq("session_key", sessionKey));
            if (session == null) return;
            // 仅在标题为默认值时才自动生成
            String title = session.getTitle();
            if (title != null && !title.isEmpty() && !"新对话".equals(title)) {
                return;
            }
            // 检查是否只有这一条 user 消息（首条）
            long userMsgCount = messageService.count(
                new QueryWrapper<AgentMessage>().eq("session_key", sessionKey).eq("role", "user"));
            if (userMsgCount != 1) return;

            String briefTitle = generateBriefTitle(userMessage);
            if (briefTitle != null && !briefTitle.isEmpty()) {
                session.setTitle(briefTitle);
                session.setUpdatedAt(LocalDateTime.now());
                sessionService.updateById(session);
                log.info("Auto-generated session title: {} -> {}", sessionKey.substring(0, 8), briefTitle);
            }
        } catch (Exception e) {
            log.warn("Failed to auto-generate title: {}", e.getMessage());
        }
    }

    /**
     * 用 LLM 生成简短标题（非流式，max_tokens=20）
     */
    private String generateBriefTitle(String userMessage) throws Exception {
        AgentModelConfigService.LlmConfig cfg = modelConfigService.getLlmConfig();
        // 截断过长的用户消息
        String truncated = userMessage.length() > 200 ? userMessage.substring(0, 200) : userMessage;
        JSONArray messagesArr = new JSONArray();
        messagesArr.add(new JSONObject().set("role", "system").set("content",
            "请用中文为以下用户问题生成一个简短的对话标题（不超过15个字，不要加引号、不要加标点符号结尾）。只输出标题文本。"));
        messagesArr.add(new JSONObject().set("role", "user").set("content", truncated));
        JSONObject body = new JSONObject()
            .set("model", cfg.getModel())
            .set("temperature", 0.3)
            .set("messages", messagesArr)
            .set("max_tokens", 30);

        String url = cfg.getApiHost();
        if (!url.endsWith("/")) url += "/";
        url += "chat/completions";

        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + cfg.getApiKey());
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        conn.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));

        if (conn.getResponseCode() != 200) {
            log.warn("Title generation LLM call failed: {}", conn.getResponseCode());
            return null;
        }
        String resp = readAll(conn.getInputStream());
        JSONObject respJson = JSONUtil.parseObj(resp);
        String title = respJson.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getStr("content");
        // 清理标题：去引号、去换行、限制长度
        if (title != null) {
            title = title.replaceAll("[\"'\\u201c\\u201d\\u2018\\u2019「」]", "").trim();
            title = title.replaceAll("[\\r\\n]", "");
            if (title.length() > 20) {
                title = title.substring(0, 20);
            }
        }
        return title;
    }

    /**
     * 流式调用 LLM，透传 token，处理 tool_calls
     */
    private void streamLlm(SseEmitter emitter, String sessionKey, String locale, String pageContext) throws Exception {
        String loc = (locale != null) ? locale : "zh-CN";
        long startTime = System.currentTimeMillis();

        // === 1. 加载模型配置 ===
        AgentModelConfigService.LlmConfig llmConfig = modelConfigService.getLlmConfig();
        log.info("[{}] LLM config: model={}, apiHost={}, temperature={}, maxTokens={}, contextWindow={}",
                sessionKey.substring(0, Math.min(8, sessionKey.length())),
                llmConfig.getModel(), llmConfig.getApiHost(), llmConfig.getTemperature(),
                llmConfig.getMaxTokens(), llmConfig.getContextWindow());

        // === 2. 加载历史消息 ===
        List<JSONObject> history = loadMessages(sessionKey);
        log.info("[{}] Loaded history: {} messages", sessionKey.substring(0, 8), history.size());

        // === 3. 加载系统提示词 ===
        String systemPrompt = toolRegistry.getSystemPrompt(loc, pageContext);
        log.info("[{}] System prompt loaded: {} chars, locale={}", sessionKey.substring(0, 8), systemPrompt.length(), loc);

        // === 4. 加载 RAG 知识库 ===
        long ragStart = System.currentTimeMillis();
        String ragContext = buildRagContext(history);
        long ragMs = System.currentTimeMillis() - ragStart;
        int ragChunks = 0;
        if (ragContext != null) {
            systemPrompt += "\n\n" + ragContext;
            // 估算命中条数
            ragChunks = ragContext.split("\\[\\d+\\]").length - 1;
        }
        log.info("[{}] RAG retrieval: {} chunks matched in {}ms", sessionKey.substring(0, 8), ragChunks, ragMs);

        // === 5. 加载知识图谱 ===
        long graphStart = System.currentTimeMillis();
        String graphContext = buildGraphContext(history);
        long graphMs = System.currentTimeMillis() - graphStart;
        int graphNodes = 0;
        if (graphContext != null) {
            systemPrompt += "\n\n" + graphContext;
            graphNodes = graphContext.split("节点:").length - 1;
        }
        log.info("[{}] Knowledge graph: {} nodes matched in {}ms", sessionKey.substring(0, 8), graphNodes, graphMs);

        // === 6. 加载工具定义 ===
        long toolsStart = System.currentTimeMillis();
        JSONArray toolsSchema = toolRegistry.getToolsSchema();
        long toolsMs = System.currentTimeMillis() - toolsStart;
        log.info("[{}] Tools loaded: {} definitions in {}ms", sessionKey.substring(0, 8), toolsSchema.size(), toolsMs);

        // === 7. 构建 messages ===
        List<JSONObject> messages = new ArrayList<>();
        messages.add(new JSONObject().set("role", "system").set("content", systemPrompt));
        messages.addAll(history);

        // === 8. 构建请求体 ===
        JSONObject body = new JSONObject()
            .set("model", llmConfig.getModel())
            .set("temperature", llmConfig.getTemperature())
            .set("messages", messages)
            .set("stream", true);
        // 仅在有工具时才发送 tools 字段（空数组会导致部分 LLM 报错）
        if (toolsSchema != null && !toolsSchema.isEmpty()) {
            body.set("tools", toolsSchema);
        }
        if (llmConfig.getMaxTokens() > 0) {
            body.set("max_tokens", llmConfig.getMaxTokens());
        }

        // === 9. 发送 context_loaded 调试事件（清晰展示加载了什么） ===
        JSONObject contextInfo = new JSONObject()
            .set("model", llmConfig.getModel())
            .set("apiHost", llmConfig.getApiHost())
            .set("temperature", llmConfig.getTemperature())
            .set("maxTokens", llmConfig.getMaxTokens())
            .set("contextWindow", llmConfig.getContextWindow())
            .set("historyMessages", history.size())
            .set("systemPromptChars", systemPrompt.length())
            .set("ragChunks", ragChunks)
            .set("ragMs", ragMs)
            .set("graphNodes", graphNodes)
            .set("graphMs", graphMs)
            .set("toolsCount", toolsSchema.size())
            .set("toolsMs", toolsMs)
            .set("totalMessages", messages.size());
        emitter.send(SseEmitter.event().name("context_loaded").data(contextInfo.toString()));

        // === 10. 发送 debug_request 事件（含工具列表，方便排查） ===
        emitter.send(SseEmitter.event().name("debug_request").data(
            new JSONObject()
                .set("messages", messages)
                .set("model", llmConfig.getModel())
                .set("temperature", llmConfig.getTemperature())
                .set("maxTokens", llmConfig.getMaxTokens())
                .set("toolsCount", toolsSchema.size())
                .set("tools", toolsSchema)
                .set("timestamp", System.currentTimeMillis())
                .toString()
        ));

        // === 11. 发起 HTTP 请求 ===
        String url = llmConfig.getApiHost();
        if (!url.endsWith("/")) url += "/";
        url += "chat/completions";

        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + llmConfig.getApiKey());
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(0);
        conn.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));

        int responseCode = conn.getResponseCode();
        if (responseCode != 200) {
            String errBody = readAll(conn.getErrorStream());
            log.error("[{}] LLM API failed: {} {}", sessionKey.substring(0, 8), responseCode, errBody);
            throw new RuntimeException("LLM API 调用失败: " + responseCode + " " + errBody);
        }

        // === 12. 解析 SSE 流 ===
        StringBuilder contentBuilder = new StringBuilder();
        Map<Integer, JSONObject> toolCallsMap = new TreeMap<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.startsWith("data:")) continue;
                String data = line.substring(5).trim();
                if ("[DONE]".equals(data)) break;
                if (data.isEmpty()) continue;

                JSONObject chunk = JSONUtil.parseObj(data);
                JSONArray choices = chunk.getJSONArray("choices");
                if (choices == null || choices.isEmpty()) continue;
                JSONObject choice = choices.getJSONObject(0);
                JSONObject delta = choice.getJSONObject("delta");
                if (delta == null) continue;

                if (delta.containsKey("content")) {
                    String token = delta.getStr("content");
                    if (token != null && !token.isEmpty()) {
                        contentBuilder.append(token);
                        emitter.send(SseEmitter.event().name("token")
                            .data(new JSONObject().set("content", token).toString()));
                    }
                }

                if (delta.containsKey("tool_calls")) {
                    JSONArray tcs = delta.getJSONArray("tool_calls");
                    for (int i = 0; i < tcs.size(); i++) {
                        JSONObject tc = tcs.getJSONObject(i);
                        int idx = tc.getInt("index", 0);
                        JSONObject entry = toolCallsMap.computeIfAbsent(idx, k -> new JSONObject());
                        if (tc.containsKey("id")) entry.set("id", tc.getStr("id"));
                        if (tc.containsKey("type")) entry.set("type", tc.getStr("type"));
                        JSONObject func = tc.getJSONObject("function");
                        if (func != null) {
                            JSONObject entryFunc = entry.getJSONObject("function");
                            if (entryFunc == null) {
                                entryFunc = new JSONObject();
                                entry.set("function", entryFunc);
                            }
                            if (func.containsKey("name")) entryFunc.set("name", func.getStr("name"));
                            if (func.containsKey("arguments")) {
                                String args = entryFunc.getStr("arguments", "");
                                entryFunc.set("arguments", args + func.getStr("arguments"));
                            }
                        }
                    }
                }
            }
        }

        long durationMs = System.currentTimeMillis() - startTime;

        // === 13. 保存 assistant 消息 ===
        String content = contentBuilder.toString();
        String toolCallsJson = toolCallsMap.isEmpty() ? null
            : JSONUtil.toJsonStr(new ArrayList<>(toolCallsMap.values()));
        saveMessage(sessionKey, "assistant", content, toolCallsJson, null, null, null);

        // === 14. 发送 debug_response 事件 ===
        emitter.send(SseEmitter.event().name("debug_response").data(
            new JSONObject()
                .set("content", content)
                .set("toolCalls", toolCallsMap.size())
                .set("durationMs", durationMs)
                .toString()
        ));

        log.info("[{}] LLM response: {} chars, {} tool_calls, {}ms",
                sessionKey.substring(0, 8), content.length(), toolCallsMap.size(), durationMs);

        // === 15. 处理 tool_calls ===
        if (!toolCallsMap.isEmpty()) {
            handleToolCalls(emitter, sessionKey, new ArrayList<>(toolCallsMap.values()));
        }
    }

    /**
     * 构建 RAG 知识库参考上下文
     */
    private String buildRagContext(List<JSONObject> history) {
        String userText = extractLastUserText(history);
        if (userText == null || userText.isEmpty()) {
            return null;
        }

        List<AgentKnowledgeChunk> chunks = searchChunks(userText);
        if (chunks == null || chunks.isEmpty()) {
            return null;
        }

        StringBuilder sb = new StringBuilder("## 知识库参考\n以下是与用户问题相关的知识片段：\n");
        for (int i = 0; i < chunks.size(); i++) {
            AgentKnowledgeChunk c = chunks.get(i);
            sb.append("[").append(i + 1).append("] ")
                .append(c.getTitle() != null ? c.getTitle() : "").append(": ")
                .append(c.getContent() != null ? c.getContent() : "").append("\n");
        }
        return sb.toString();
    }

    /**
     * 知识库分块检索：优先向量余弦相似度，embedding 不可用时退化为关键词 LIKE
     */
    private List<AgentKnowledgeChunk> searchChunks(String userText) {
        double[] userEmbedding = embeddingService.embed(userText);
        if (userEmbedding != null) {
            List<AgentKnowledgeChunk> allChunks = knowledgeChunkService.list(
                new QueryWrapper<AgentKnowledgeChunk>().isNotNull("embedding"));
            List<AbstractMap.Entry<Double, AgentKnowledgeChunk>> pairs = new ArrayList<>();
            for (AgentKnowledgeChunk chunk : allChunks) {
                double[] chunkEmb = embeddingService.jsonToEmbedding(chunk.getEmbedding());
                if (chunkEmb == null) continue;
                double sim = cosineSimilarity(userEmbedding, chunkEmb);
                pairs.add(new AbstractMap.SimpleEntry<>(sim, chunk));
            }
            pairs.sort((a, b) -> Double.compare(b.getKey(), a.getKey()));
            List<AgentKnowledgeChunk> result = new ArrayList<>();
            for (int i = 0; i < Math.min(3, pairs.size()); i++) {
                result.add(pairs.get(i).getValue());
            }
            if (!result.isEmpty()) {
                log.debug("RAG vector search: {} chunks with embeddings, returned top {}", allChunks.size(), result.size());
                return result;
            }
            // 向量检索无结果时也降级为关键词
        }
        // embedding 不可用：关键词 LIKE 兜底（分词后 OR 匹配，提高召回率）
        List<AgentKnowledgeChunk> keywordResults = searchByKeywords(userText);
        if (userEmbedding == null) {
            log.debug("RAG keyword fallback (embedding unavailable): {} chunks", keywordResults.size());
        } else {
            log.debug("RAG keyword fallback (no vector results): {} chunks", keywordResults.size());
        }
        return keywordResults;
    }

    /**
     * 分词后按关键词 OR LIKE 检索知识库分块
     */
    private List<AgentKnowledgeChunk> searchByKeywords(String userText) {
        // 按空格和标点分词，保留长度 >=2 的词
        String[] keywords = userText.split("[\\s,，。.;；、？?！!\\n\\r]+");
        List<String> validKeywords = new ArrayList<>();
        for (String kw : keywords) {
            String trimmed = kw.trim();
            if (trimmed.length() >= 2) {
                validKeywords.add(trimmed);
            }
        }
        if (validKeywords.isEmpty()) {
            return Collections.emptyList();
        }

        // 对每个关键词做 LIKE 查询，合并去重，取前 3 条
        List<AgentKnowledgeChunk> results = new ArrayList<>();
        for (String kw : validKeywords) {
            if (results.size() >= 3) break;
            List<AgentKnowledgeChunk> hits = knowledgeChunkService.list(
                new QueryWrapper<AgentKnowledgeChunk>().like("content", kw).last("LIMIT 5"));
            for (AgentKnowledgeChunk hit : hits) {
                boolean exists = false;
                for (AgentKnowledgeChunk existing : results) {
                    if (existing.getId() != null && existing.getId().equals(hit.getId())) {
                        exists = true;
                        break;
                    }
                }
                if (!exists) {
                    results.add(hit);
                    if (results.size() >= 3) break;
                }
            }
        }
        return results;
    }

    /**
     * 构建知识图谱参考上下文：从用户问题中提取关键词，检索相关图谱节点及其邻居
     */
    private String buildGraphContext(List<JSONObject> history) {
        String userText = extractLastUserText(history);
        if (userText == null || userText.isEmpty()) {
            return null;
        }

        // 按 title 做 LIKE 匹配，找出相关的图谱节点
        List<AgentGraphNode> matchedNodes = graphNodeService.list(
            new QueryWrapper<AgentGraphNode>().like("title", userText).last("LIMIT 5"));

        if (matchedNodes.isEmpty()) {
            // 尝试按关键词拆分后匹配
            String[] keywords = userText.split("[\\s,，。.;；、？?！!]+");
            for (String kw : keywords) {
                if (kw.length() < 2) continue;
                matchedNodes = graphNodeService.list(
                    new QueryWrapper<AgentGraphNode>().like("title", kw).last("LIMIT 5"));
                if (!matchedNodes.isEmpty()) break;
            }
        }

        if (matchedNodes.isEmpty()) {
            return null;
        }

        StringBuilder sb = new StringBuilder("## 知识图谱参考\n以下是与用户问题相关的概念和关系：\n");
        for (AgentGraphNode node : matchedNodes) {
            sb.append("节点: ").append(node.getTitle()).append(" (").append(node.getNodeType()).append(")");
            if (node.getProperties() != null) {
                try {
                    JSONObject props = JSONUtil.parseObj(node.getProperties());
                    String desc = props.getStr("description");
                    if (desc != null && !desc.isEmpty()) {
                        sb.append(" — ").append(desc);
                    }
                } catch (Exception ignored) {}
            }
            sb.append("\n");

            // 查找该节点的邻居边
            List<AgentGraphEdge> outEdges = graphEdgeService.list(
                new QueryWrapper<AgentGraphEdge>().eq("source_key", node.getNodeKey()).last("LIMIT 5"));
            for (AgentGraphEdge edge : outEdges) {
                AgentGraphNode target = graphNodeService.getOne(
                    new QueryWrapper<AgentGraphNode>().eq("node_key", edge.getTargetKey()));
                if (target != null) {
                    sb.append("  →[").append(edge.getEdgeType()).append("]→ ")
                        .append(target.getTitle()).append("\n");
                }
            }
        }
        return sb.toString();
    }

    /**
     * 从历史消息中提取最后一条 user 消息文本
     */
    private String extractLastUserText(List<JSONObject> history) {
        for (int i = history.size() - 1; i >= 0; i--) {
            JSONObject m = history.get(i);
            if ("user".equals(m.getStr("role"))) {
                Object contentObj = m.get("content");
                if (contentObj instanceof String) {
                    return (String) contentObj;
                } else if (contentObj instanceof JSONArray) {
                    JSONArray arr = (JSONArray) contentObj;
                    StringBuilder textBuilder = new StringBuilder();
                    for (int j = 0; j < arr.size(); j++) {
                        JSONObject part = arr.getJSONObject(j);
                        if ("text".equals(part.getStr("type"))) {
                            textBuilder.append(part.getStr("text"));
                        }
                    }
                    return textBuilder.toString();
                }
                break;
            }
        }
        return null;
    }

    /**
     * 计算两个向量的余弦相似度
     */
    private double cosineSimilarity(double[] a, double[] b) {
        if (a == null || b == null || a.length != b.length || a.length == 0) {
            return 0;
        }
        double dot = 0, normA = 0, normB = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA == 0 || normB == 0) {
            return 0;
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * 处理 tool_calls：查权限，推 tool_call 事件给前端
     */
    private void handleToolCalls(SseEmitter emitter, String sessionKey, List<JSONObject> toolCalls) throws Exception {
        for (JSONObject tc : toolCalls) {
            String id = tc.getStr("id");
            JSONObject func = tc.getJSONObject("function");
            String action = func != null ? func.getStr("name") : "unknown";
            String argsStr = (func != null && func.containsKey("arguments")) ? func.getStr("arguments") : "{}";

            JSONObject args;
            try {
                args = JSONUtil.parseObj(argsStr);
            } catch (Exception e) {
                args = new JSONObject().set("raw", argsStr);
            }

            String policy = getPolicy(sessionKey, action);

            JSONObject event = new JSONObject()
                .set("id", id)
                .set("action", action)
                .set("args", args)
                .set("policy", policy);
            emitter.send(SseEmitter.event().name("tool_call").data(event.toString()));
        }
    }

    /**
     * 查询权限策略（优先级：会话级 > 全局默认 > 工具注册表默认）
     */
    private String getPolicy(String sessionKey, String action) {
        AgentPermission perm = permissionService.getOne(
            new QueryWrapper<AgentPermission>()
                .eq("session_key", sessionKey)
                .eq("action", action));
        if (perm != null) return perm.getPolicy();
        AgentGlobalPermission global = globalPermissionService.getOne(
            new QueryWrapper<AgentGlobalPermission>().eq("action", action));
        if (global != null) return global.getPolicy();
        return toolRegistry.getDefaultPolicy(action);
    }

    /**
     * 加载历史消息（最近 N 条），转成 OpenAI messages 格式
     * 在 user 消息边界截断，避免出现悬空的 tool_calls
     */
    private List<JSONObject> loadMessages(String sessionKey) {
        int max = properties.getHistory().getMaxMessages();
        QueryWrapper<AgentMessage> wrapper = new QueryWrapper<>();
        wrapper.eq("session_key", sessionKey).orderByDesc("id").last("LIMIT " + max);
        List<AgentMessage> msgs = messageService.list(wrapper);
        Collections.reverse(msgs);

        if (!msgs.isEmpty() && !"user".equals(msgs.get(0).getRole())) {
            int firstUserIndex = -1;
            for (int i = 0; i < msgs.size(); i++) {
                if ("user".equals(msgs.get(i).getRole())) {
                    firstUserIndex = i;
                    break;
                }
            }
            if (firstUserIndex > 0) {
                msgs = msgs.subList(firstUserIndex, msgs.size());
            }
        }

        List<JSONObject> result = new ArrayList<>();
        for (AgentMessage msg : msgs) {
            JSONObject m = new JSONObject().set("role", msg.getRole());
            if (msg.getImages() != null && !msg.getImages().isEmpty() && "user".equals(msg.getRole())) {
                JSONArray contentArr = new JSONArray();
                if (msg.getContent() != null && !msg.getContent().isEmpty()) {
                    contentArr.add(new JSONObject().set("type", "text").set("text", msg.getContent()));
                }
                try {
                    JSONArray imgs = JSONUtil.parseArray(msg.getImages());
                    for (int i = 0; i < imgs.size(); i++) {
                        contentArr.add(new JSONObject().set("type", "image_url")
                            .set("image_url", new JSONObject().set("url", imgs.getStr(i))));
                    }
                } catch (Exception ignored) {}
                m.set("content", contentArr);
            } else if (msg.getContent() != null && !msg.getContent().isEmpty()) {
                m.set("content", msg.getContent());
            }
            if (msg.getToolCalls() != null && !msg.getToolCalls().isEmpty()) {
                m.set("tool_calls", JSONUtil.parseArray(msg.getToolCalls()));
            }
            if (msg.getToolCallId() != null && !msg.getToolCallId().isEmpty()) {
                m.set("tool_call_id", msg.getToolCallId());
            }
            result.add(m);
        }
        return result;
    }

    /**
     * 保存消息
     */
    private void saveMessage(String sessionKey, String role, String content,
                             String toolCalls, String toolCallId, String pageContext,
                             List<String> images) {
        AgentMessage msg = new AgentMessage();
        msg.setSessionKey(sessionKey);
        msg.setRole(role);
        msg.setContent(content);
        msg.setToolCalls(toolCalls);
        msg.setToolCallId(toolCallId);
        msg.setPageContext(pageContext);
        msg.setImages(images != null && !images.isEmpty() ? JSONUtil.toJsonStr(images) : null);
        msg.setCreatedAt(LocalDateTime.now());
        messageService.save(msg);
    }

    private void sendError(SseEmitter emitter, String message) {
        try {
            emitter.send(SseEmitter.event().name("error")
                .data(new JSONObject().set("message", message).toString()));
            emitter.complete();
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
    }

    private String readAll(java.io.InputStream is) {
        if (is == null) return "";
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }
}
