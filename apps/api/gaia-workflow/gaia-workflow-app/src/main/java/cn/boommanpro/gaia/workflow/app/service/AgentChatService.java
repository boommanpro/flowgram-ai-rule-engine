package cn.boommanpro.gaia.workflow.app.service;

import cn.boommanpro.gaia.workflow.app.config.AgentProperties;
import cn.boommanpro.gaia.workflow.app.domain.agent.input.ChatInput;
import cn.boommanpro.gaia.workflow.app.domain.agent.input.ToolResultInput;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentMessage;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentPermission;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentMessageService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentPermissionService;
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
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Agent 对话编排服务
 * 负责：保存消息、加载历史、调 LLM（SSE 流式）、透传 token、处理 tool_calls 权限
 */
@Slf4j
@Service
public class AgentChatService {

    private final AgentMessageService messageService;
    private final AgentPermissionService permissionService;
    private final AgentToolRegistry toolRegistry;
    private final AgentProperties properties;

    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "agent-chat");
        t.setDaemon(true);
        return t;
    });

    public AgentChatService(AgentMessageService messageService,
                            AgentPermissionService permissionService,
                            AgentToolRegistry toolRegistry,
                            AgentProperties properties) {
        this.messageService = messageService;
        this.permissionService = permissionService;
        this.toolRegistry = toolRegistry;
        this.properties = properties;
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
                // 1. 保存 user 消息
                saveMessage(input.getSessionKey(), "user", input.getMessage(), null, null, input.getPageContext());
                // 2. 流式调 LLM
                streamLlm(emitter, input.getSessionKey(), input.getLocale(), input.getPageContext());
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
                    saveMessage(input.getSessionKey(), "tool", content, null, item.getToolCallId(), null);
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
     * 流式调用 LLM，透传 token，处理 tool_calls
     */
    private void streamLlm(SseEmitter emitter, String sessionKey, String locale, String pageContext) throws Exception {
        String loc = (locale != null) ? locale : "zh-CN";

        // 构建 messages
        List<JSONObject> messages = new ArrayList<>();
        messages.add(new JSONObject().set("role", "system").set("content", toolRegistry.getSystemPrompt(loc, pageContext)));
        messages.addAll(loadMessages(sessionKey));

        // 构建请求体
        JSONObject body = new JSONObject()
            .set("model", properties.getLlm().getModel())
            .set("temperature", properties.getLlm().getTemperature())
            .set("messages", messages)
            .set("tools", toolRegistry.getToolsSchema())
            .set("stream", true);

        // 发起 HTTP 请求
        String url = properties.getLlm().getApiHost();
        if (!url.endsWith("/")) url += "/";
        url += "chat/completions";

        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + properties.getLlm().getApiKey());
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(0);
        conn.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));

        int responseCode = conn.getResponseCode();
        if (responseCode != 200) {
            String errBody = readAll(conn.getErrorStream());
            throw new RuntimeException("LLM API 调用失败: " + responseCode + " " + errBody);
        }

        // 解析 SSE 流
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

                // content token
                if (delta.containsKey("content")) {
                    String token = delta.getStr("content");
                    if (token != null && !token.isEmpty()) {
                        contentBuilder.append(token);
                        emitter.send(SseEmitter.event().name("token")
                            .data(new JSONObject().set("content", token).toString()));
                    }
                }

                // tool_calls（流式增量）
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

        // 保存 assistant 消息
        String content = contentBuilder.toString();
        String toolCallsJson = toolCallsMap.isEmpty() ? null
            : JSONUtil.toJsonStr(new ArrayList<>(toolCallsMap.values()));
        saveMessage(sessionKey, "assistant", content, toolCallsJson, null, null);

        // 处理 tool_calls
        if (!toolCallsMap.isEmpty()) {
            handleToolCalls(emitter, sessionKey, new ArrayList<>(toolCallsMap.values()));
        }
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

            // 解析 args（可能是非法 JSON，兜底处理）
            JSONObject args;
            try {
                args = JSONUtil.parseObj(argsStr);
            } catch (Exception e) {
                args = new JSONObject().set("raw", argsStr);
            }

            String policy = getPolicy(sessionKey, action);

            // 推 tool_call 事件
            JSONObject event = new JSONObject()
                .set("id", id)
                .set("action", action)
                .set("args", args)
                .set("policy", policy);
            emitter.send(SseEmitter.event().name("tool_call").data(event.toString()));
        }
    }

    /**
     * 查询权限策略
     */
    private String getPolicy(String sessionKey, String action) {
        AgentPermission perm = permissionService.getOne(
            new QueryWrapper<AgentPermission>()
                .eq("session_key", sessionKey)
                .eq("action", action));
        return perm != null ? perm.getPolicy() : toolRegistry.getDefaultPolicy(action);
    }

    /**
     * 加载历史消息（最近 N 条），转成 OpenAI messages 格式
     */
    private List<JSONObject> loadMessages(String sessionKey) {
        int max = properties.getHistory().getMaxMessages();
        QueryWrapper<AgentMessage> wrapper = new QueryWrapper<>();
        wrapper.eq("session_key", sessionKey).orderByDesc("id").last("LIMIT " + max);
        List<AgentMessage> msgs = messageService.list(wrapper);
        Collections.reverse(msgs);

        List<JSONObject> result = new ArrayList<>();
        for (AgentMessage msg : msgs) {
            JSONObject m = new JSONObject().set("role", msg.getRole());
            if (msg.getContent() != null && !msg.getContent().isEmpty()) {
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
                             String toolCalls, String toolCallId, String pageContext) {
        AgentMessage msg = new AgentMessage();
        msg.setSessionKey(sessionKey);
        msg.setRole(role);
        msg.setContent(content);
        msg.setToolCalls(toolCalls);
        msg.setToolCallId(toolCallId);
        msg.setPageContext(pageContext);
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
