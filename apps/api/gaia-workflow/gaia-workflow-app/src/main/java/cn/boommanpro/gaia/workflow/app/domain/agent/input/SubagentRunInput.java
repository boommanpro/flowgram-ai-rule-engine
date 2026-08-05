package cn.boommanpro.gaia.workflow.app.domain.agent.input;

import cn.hutool.json.JSONArray;
import lombok.Data;

/**
 * Subagent 单节点调试运行请求
 */
@Data
public class SubagentRunInput {
    /**
     * 会话标识（作为 subagent 会话 id）
     */
    private String sessionKey;
    /**
     * 调试指令
     */
    private String message;
    /**
     * 语言（zh-CN / en-US）
     */
    private String locale;
    /**
     * 页面上下文 JSON
     */
    private String pageContext;
    /**
     * 暴露给 LLM 的工具 schema，nullable，为空时使用全部工具
     */
    private JSONArray tools;
}
