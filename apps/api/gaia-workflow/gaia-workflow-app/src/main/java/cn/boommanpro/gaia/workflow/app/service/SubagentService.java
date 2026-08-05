package cn.boommanpro.gaia.workflow.app.service;

import cn.boommanpro.gaia.workflow.app.config.AgentProperties;
import cn.boommanpro.gaia.workflow.app.domain.agent.input.SubagentRunInput;
import cn.boommanpro.gaia.workflow.app.domain.agent.input.SubagentToolResultInput;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.annotation.PreDestroy;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Subagent 单节点调试服务
 * 提供 isolated SSE 会话，不写入 agent_message 表，内存维护对话上下文。
 * 支持多轮 tool_calls 自动执行循环（服务端模拟执行，真实执行可由前端 /tool-result 覆盖）。
 */
@Slf4j
@Service
public class SubagentService {

    private final AgentToolRegistry toolRegistry;
    private final AgentProperties properties;

    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "subagent");
        t.setDaemon(true);
        return t;
    });

    private final ConcurrentHashMap<String, SubagentSession> sessions = new ConcurrentHashMap<>();

    public SubagentService(AgentToolRegistry toolRegistry, AgentProperties properties) {
        this.toolRegistry = toolRegistry;
        this.properties = properties;
    }

    @PreDestroy
    public void destroy() {
        executor.shutdown();
    }

    /**
     * 内存会话上下文
     */
    private static class SubagentSession {
        final List<JSONObject> messages = new ArrayList<>();
        String locale;
        String pageContext;
    }

    /**
     * 单轮 LLM 调用结果
     */
    private static class RoundResult {
        String content;
        List<JSONObject> toolCalls;
    }

    /**
     * 调试运行入口（SSE）
     */
    public void run(SseEmitter emitter, SubagentRunInput input) {
        executor.execute(() -> {
            try {
                // 1. 获取或创建会话（仅新建时写入 system 消息）
                SubagentSession session = sessions.computeIfAbsent(input.getSessionKey(), k -> {
                    SubagentSession s = new SubagentSession();
                    s.locale = input.getLocale();
                    s.pageContext = input.getPageContext();
                    String loc = (input.getLocale() != null) ? input.getLocale() : "zh-CN";
                    s.messages.add(new JSONObject()
                        .set("role", "system")
                        .set("content", toolRegistry.getSystemPrompt(loc, input.getPageContext())));
                    return s;
                });
                // 2. 追加 user 消息
                session.messages.add(new JSONObject()
                    .set("role", "user")
                    .set("content", input.getMessage()));

                JSONArray tools = input.getTools() != null ? input.getTools() : toolRegistry.getToolsSchema();
                // 3. 进入自动执行循环
                runLoop(emitter, session, tools);

                emitter.send(SseEmitter.event().name("subagent_done").data("{}"));
                emitter.complete();
            } catch (Exception e) {
                log.error("Subagent run error", e);
                sendError(emitter, e.getMessage());
            }
        });
    }

    /**
     * 工具结果回灌后继续循环（SSE）
     */
    public void toolResult(SseEmitter emitter, SubagentToolResultInput input) {
        executor.execute(() -> {
            try {
                SubagentSession session = sessions.get(input.getSessionKey());
                if (session == null) {
                    sendError(emitter, "session not found: " + input.getSessionKey());
                    return;
                }
                // 追加 tool 结果消息
                for (SubagentToolResultInput.ResultItem item : input.getResults()) {
                    String content = item.isRejected()
                        ? "{\"error\":\"rejected\"}"
                        : (item.getResult() != null ? item.getResult() : "{}");
                    session.messages.add(new JSONObject()
                        .set("role", "tool")
                        .set("content", content)
                        .set("tool_call_id", item.getToolCallId()));
                }

                JSONArray tools = toolRegistry.getToolsSchema();
                runLoop(emitter, session, tools);

                emitter.send(SseEmitter.event().name("subagent_done").data("{}"));
                emitter.complete();
            } catch (Exception e) {
                log.error("Subagent toolResult error", e);
                sendError(emitter, e.getMessage());
            }
        });
    }

    /**
     * 多轮自动执行循环：streamRound → 若有 tool_calls 则发事件并模拟执行 → 继续下一轮，最多 10 轮。
     */
    private void runLoop(SseEmitter emitter, SubagentSession session, JSONArray tools) throws Exception {
        int maxRounds = 10;
        for (int round = 1; round <= maxRounds; round++) {
            RoundResult result = streamRound(emitter, session, tools);

            if (result.toolCalls.isEmpty()) {
                // LLM 给出最终回答
                emitter.send(SseEmitter.event().name("subagent_final_result")
                    .data(new JSONObject().set("content", result.content).toString()));
                break;
            }

            // 处理每个 tool_call：发事件 + 模拟自动执行（写入 tool 结果消息）
            for (JSONObject tc : result.toolCalls) {
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

                emitter.send(SseEmitter.event().name("subagent_tool_call")
                    .data(new JSONObject()
                        .set("id", id)
                        .set("action", action)
                        .set("args", args)
                        .toString()));

                // 模拟自动执行：写入占位 tool 结果，让 LLM 继续对话
                session.messages.add(new JSONObject()
                    .set("role", "tool")
                    .set("content", "{\"status\":\"executed\"}")
                    .set("tool_call_id", id));
            }

            emitter.send(SseEmitter.event().name("subagent_round_done")
                .data(new JSONObject()
                    .set("round", round)
                    .set("toolCalls", result.toolCalls.size())
                    .toString()));
        }
    }

    /**
     * 单轮 LLM 流式调用：透传 token、累积 tool_calls、追加 assistant 消息到会话。
     */
    private RoundResult streamRound(SseEmitter emitter, SubagentSession session, JSONArray tools) throws Exception {
        // 构建请求体
        JSONObject body = new JSONObject()
            .set("model", properties.getLlm().getModel())
            .set("temperature", properties.getLlm().getTemperature())
            .set("messages", session.messages)
            .set("tools", tools != null ? tools : toolRegistry.getToolsSchema())
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

        String content = contentBuilder.toString();
        List<JSONObject> toolCalls = new ArrayList<>(toolCallsMap.values());

        // 追加 assistant 消息到会话上下文
        JSONObject assistantMsg = new JSONObject()
            .set("role", "assistant")
            .set("content", content);
        if (!toolCalls.isEmpty()) {
            JSONArray toolCallsArray = new JSONArray();
            for (JSONObject tc : toolCalls) {
                toolCallsArray.add(tc);
            }
            assistantMsg.set("tool_calls", toolCallsArray);
        }
        session.messages.add(assistantMsg);

        RoundResult rr = new RoundResult();
        rr.content = content;
        rr.toolCalls = toolCalls;
        return rr;
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
