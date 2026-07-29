package cn.boommanpro.gaia.workflow.infra.manage.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * Agent 对话会话
 */
@Data
@TableName("agent_session")
public class AgentSession {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /**
     * 会话标识（浏览器生成的 UUID）
     */
    @TableField("session_key")
    private String sessionKey;

    /**
     * 会话标题
     */
    @TableField("title")
    private String title;

    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    /**
     * 是否删除（0-未删除，1-已删除）
     */
    @TableField("is_deleted")
    @TableLogic
    private Integer isDeleted;
}
