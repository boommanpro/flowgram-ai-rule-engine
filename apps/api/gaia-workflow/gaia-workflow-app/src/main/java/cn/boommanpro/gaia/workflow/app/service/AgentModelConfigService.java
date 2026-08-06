package cn.boommanpro.gaia.workflow.app.service;

import cn.boommanpro.gaia.workflow.app.config.AgentProperties;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentConfig;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentConfigService;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 模型配置服务 — 数据库优先，application.yml 兜底
 *
 * <p>数据库中 agent_config 表 configKey={@link #LLM_CONFIG_KEY} 的 config_data 字段
 * 存储完整 JSON 配置，修改后即时生效（无缓存），全局影响 AgentChatService / SubagentService。
 */
@Slf4j
@Service
public class AgentModelConfigService {

    public static final String LLM_CONFIG_KEY = "llm_config";
    public static final String EMBEDDING_CONFIG_KEY = "embedding_config";

    private final AgentConfigService configService;
    private final AgentProperties properties;

    public AgentModelConfigService(AgentConfigService configService, AgentProperties properties) {
        this.configService = configService;
        this.properties = properties;
    }

    /**
     * 获取当前生效的 LLM 配置（DB 优先 → yml 默认值兜底）
     */
    public LlmConfig getLlmConfig() {
        AgentConfig config = configService.getOne(
                new QueryWrapper<AgentConfig>().eq("config_key", LLM_CONFIG_KEY));
        if (config != null && config.getConfigData() != null && !config.getConfigData().isEmpty()) {
            try {
                JSONObject json = JSONUtil.parseObj(config.getConfigData());
                LlmConfig result = new LlmConfig();
                result.setApiHost(json.getStr("apiHost", properties.getLlm().getApiHost()));
                result.setApiKey(json.getStr("apiKey", properties.getLlm().getApiKey()));
                result.setModel(json.getStr("model", properties.getLlm().getModel()));
                result.setTemperature(json.getDouble("temperature", properties.getLlm().getTemperature()));
                result.setMaxTokens(json.getInt("maxTokens", properties.getLlm().getMaxTokens()));
                result.setContextWindow(json.getInt("contextWindow", properties.getLlm().getContextWindow()));
                return result;
            } catch (Exception e) {
                log.warn("Failed to parse LLM config from DB, falling back to yml defaults: {}", e.getMessage());
            }
        }
        // yml 兜底
        LlmConfig result = new LlmConfig();
        result.setApiHost(properties.getLlm().getApiHost());
        result.setApiKey(properties.getLlm().getApiKey());
        result.setModel(properties.getLlm().getModel());
        result.setTemperature(properties.getLlm().getTemperature());
        result.setMaxTokens(properties.getLlm().getMaxTokens());
        result.setContextWindow(properties.getLlm().getContextWindow());
        return result;
    }

    /**
     * 获取当前生效的 Embedding 配置（DB 优先 → LLM 配置兜底 → yml 默认值兜底）
     *
     * <p>embedding 配置允许独立设置 apiHost/apiKey/model，任一字段留空则复用 LLM 配置，
     * 这样用户无需为 embedding 单独配置 provider（与 chat 模型共用一套即可），
     * 同时支持高级用户使用专门的 embedding 模型（如 text-embedding-3-small / bge-m3）。
     */
    public EmbeddingConfig getEmbeddingConfig() {
        LlmConfig llmConfig = getLlmConfig();
        AgentConfig config = configService.getOne(
                new QueryWrapper<AgentConfig>().eq("config_key", EMBEDDING_CONFIG_KEY));
        if (config != null && config.getConfigData() != null && !config.getConfigData().isEmpty()) {
            try {
                JSONObject json = JSONUtil.parseObj(config.getConfigData());
                EmbeddingConfig result = new EmbeddingConfig();
                // 留空字段复用 LLM 配置，避免用户必须重复填写
                result.setApiHost(json.getStr("apiHost", llmConfig.getApiHost()));
                result.setApiKey(json.getStr("apiKey", llmConfig.getApiKey()));
                result.setModel(json.getStr("model", llmConfig.getModel()));
                result.setEnabled(json.getBool("enabled", true));
                return result;
            } catch (Exception e) {
                log.warn("Failed to parse embedding config from DB, falling back to LLM config: {}", e.getMessage());
            }
        }
        // 无 DB 配置时直接复用 LLM 配置
        EmbeddingConfig result = new EmbeddingConfig();
        result.setApiHost(llmConfig.getApiHost());
        result.setApiKey(llmConfig.getApiKey());
        result.setModel(llmConfig.getModel());
        result.setEnabled(true);
        return result;
    }

    /**
     * 运行时 LLM 配置（不可变快照）
     */
    @lombok.Data
    public static class LlmConfig {
        private String apiHost;
        private String apiKey;
        private String model;
        private double temperature;
        private int maxTokens;
        private int contextWindow;
    }

    /**
     * 运行时 Embedding 配置（不可变快照）
     * 默认复用 LLM 配置，用户可通过 DB embedding_config 独立覆盖
     */
    @lombok.Data
    public static class EmbeddingConfig {
        private String apiHost;
        private String apiKey;
        private String model;
        /** 是否启用 embedding（false 时强制走关键词降级，不调用 API） */
        private boolean enabled;
    }
}
