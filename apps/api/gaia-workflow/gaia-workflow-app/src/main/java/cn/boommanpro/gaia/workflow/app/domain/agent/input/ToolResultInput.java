package cn.boommanpro.gaia.workflow.app.domain.agent.input;

import lombok.Data;
import java.util.List;

/**
 * 工具执行结果回灌请求（支持多个结果一次性回灌）
 */
@Data
public class ToolResultInput {
    private String sessionKey;
    /**
     * 语言（zh-CN / en-US）
     */
    private String locale;
    private List<ResultItem> results;

    @Data
    public static class ResultItem {
        /**
         * 对应的 tool_call_id
         */
        private String toolCallId;
        /**
         * 工具执行结果 JSON
         */
        private String result;
        /**
         * 是否被用户拒绝
         */
        private boolean rejected;
    }
}
