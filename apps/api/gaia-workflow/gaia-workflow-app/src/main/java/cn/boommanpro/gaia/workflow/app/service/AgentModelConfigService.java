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
}
