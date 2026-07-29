package cn.boommanpro.gaia.workflow.app.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Agent 配置
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
    }

    @Data
    public static class History {
        private int maxMessages = 20;
    }
}
