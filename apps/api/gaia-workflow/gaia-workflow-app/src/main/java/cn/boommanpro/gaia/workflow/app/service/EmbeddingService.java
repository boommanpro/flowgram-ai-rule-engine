package cn.boommanpro.gaia.workflow.app.service;

import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Embedding 向量化服务
 * 负责：调用 LLM API 的 /embeddings 端点获取向量、向量与 JSON 互转
 *
 * <p>配置来源：优先从 DB embedding_config 读取（支持独立 apiHost/apiKey/model），
 * 留空字段复用 LLM 配置；embedding.enabled=false 时不调用 API，直接返回 null，
 * 由上层 AgentChatService 降级为关键词检索。
 */
@Slf4j
@Service
public class EmbeddingService {

    private final AgentModelConfigService modelConfigService;

    public EmbeddingService(AgentModelConfigService modelConfigService) {
        this.modelConfigService = modelConfigService;
    }

    /**
     * 调用 /embeddings 端点获取文本向量
     * 任何异常（配置禁用、API 不可用、解析失败、非 200）均记录警告并返回 null
     */
    public double[] embed(String text) {
        if (text == null || text.isEmpty()) {
            return null;
        }
        AgentModelConfigService.EmbeddingConfig config = modelConfigService.getEmbeddingConfig();
        if (!config.isEnabled()) {
            log.debug("Embedding 已被禁用（embedding_config.enabled=false），跳过向量检索");
            return null;
        }
        try {
            JSONObject body = new JSONObject()
                .set("model", config.getModel())
                .set("input", text);

            String url = config.getApiHost();
            if (!url.endsWith("/")) url += "/";
            url += "embeddings";

            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Authorization", "Bearer " + config.getApiKey());
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(30000);
            conn.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));

            int responseCode = conn.getResponseCode();
            if (responseCode != 200) {
                String errBody = readAll(conn.getErrorStream());
                log.warn("Embedding API 调用失败: {} {}", responseCode, errBody);
                return null;
            }

            String responseBody = readAll(conn.getInputStream());
            JSONObject resp = JSONUtil.parseObj(responseBody);
            JSONArray data = resp.getJSONArray("data");
            if (data == null || data.isEmpty()) {
                log.warn("Embedding API 返回空 data");
                return null;
            }
            JSONArray embedding = data.getJSONObject(0).getJSONArray("embedding");
            double[] vec = new double[embedding.size()];
            for (int i = 0; i < embedding.size(); i++) {
                vec[i] = embedding.getDouble(i);
            }
            return vec;
        } catch (Exception e) {
            log.warn("Embedding 调用异常: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 探测 embedding 服务是否可用（配置启用且一次平凡调用返回非空即为可用）
     */
    public boolean isAvailable() {
        AgentModelConfigService.EmbeddingConfig config = modelConfigService.getEmbeddingConfig();
        if (!config.isEnabled()) {
            return false;
        }
        return embed("ping") != null;
    }

    /**
     * 将向量序列化为 JSON 字符串
     */
    public String embedToJson(double[] vec) {
        return JSONUtil.toJsonStr(vec);
    }

    /**
     * 将 JSON 字符串反序列化为向量，解析失败返回 null
     */
    public double[] jsonToEmbedding(String json) {
        if (json == null || json.isEmpty()) {
            return null;
        }
        try {
            JSONArray arr = JSONUtil.parseArray(json);
            double[] vec = new double[arr.size()];
            for (int i = 0; i < arr.size(); i++) {
                vec[i] = arr.getDouble(i);
            }
            return vec;
        } catch (Exception e) {
            log.warn("解析 embedding JSON 失败: {}", e.getMessage());
            return null;
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
