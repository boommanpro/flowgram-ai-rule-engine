package cn.boommanpro.gaia.workflow.app.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Agent 配置（application.yml 默认值，可被数据库 agent_config 表覆盖）
 */
@Data
@Component
@ConfigurationProperties(prefix = "agent")
public class AgentProperties {

    private Llm llm = new Llm();
    private History history = new History();

    @Data
    public static class Llm {
        private String apiHost = "http://localhost:1234/v1";
        private String apiKey = "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
        private String model = "qwen/qwen3-4b-2507";
        private double temperature = 0.5;
        /** 最大输出 token 数（0 表示不限制） */
        private int maxTokens = 4096;
        /** 模型上下文窗口大小（用于历史消息截断参考） */
        private int contextWindow = 32768;
    }

    @Data
    public static class History {
        private int maxMessages = 20;
    }
}
