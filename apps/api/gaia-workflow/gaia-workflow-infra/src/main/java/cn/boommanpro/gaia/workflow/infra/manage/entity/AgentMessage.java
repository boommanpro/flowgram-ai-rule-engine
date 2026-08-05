package cn.boommanpro.gaia.workflow.infra.manage.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * Agent 对话消息
 */
@Data
@TableName("agent_message")
public class AgentMessage {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /**
     * 会话标识
     */
    @TableField("session_key")
    private String sessionKey;

    /**
     * 角色：user / assistant / tool
     */
    @TableField("role")
    private String role;

    /**
     * 文本内容
     */
    @TableField("content")
    private String content;

    /**
     * 工具调用 JSON（assistant 角色的 tool_calls 数组）
     */
    @TableField("tool_calls")
    private String toolCalls;

    /**
     * 工具结果对应的 tool_call_id（tool 角色使用）
     */
    @TableField("tool_call_id")
    private String toolCallId;

    /**
     * 发送时的页面上下文 JSON
     */
    @TableField("page_context")
    private String pageContext;

    /**
     * 多模态图片数据（JSON 数组，base64）
     */
    @TableField("images")
    private String images;

    /**
     * 父消息 ID（线程引用）
     */
    @TableField("parent_message_id")
    private String parentMessageId;

    @TableField("created_at")
    private LocalDateTime createdAt;
}
