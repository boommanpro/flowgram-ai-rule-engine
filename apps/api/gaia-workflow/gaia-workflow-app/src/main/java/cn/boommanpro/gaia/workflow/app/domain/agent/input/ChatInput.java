package cn.boommanpro.gaia.workflow.app.domain.agent.input;

import lombok.Data;

/**
 * Agent 对话请求
 */
@Data
public class ChatInput {
    /**
     * 会话标识
     */
    private String sessionKey;
    /**
     * 用户消息
     */
    private String message;
    /**
     * 页面上下文 JSON（当前路由 + 画布摘要）
     */
    private String pageContext;
    /**
     * 语言（zh-CN / en-US）
     */
    private String locale;
    /**
     * 多模态图片数据（base64 编码的 data URL 列表）
     */
    private java.util.List<String> images;
}
