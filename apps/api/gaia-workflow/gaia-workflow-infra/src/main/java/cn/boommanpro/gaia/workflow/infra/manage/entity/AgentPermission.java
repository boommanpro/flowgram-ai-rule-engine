package cn.boommanpro.gaia.workflow.infra.manage.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

/**
 * Agent 权限习惯（per-action 配置）
 */
@Data
@TableName("agent_permission")
public class AgentPermission {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /**
     * 会话标识
     */
    @TableField("session_key")
    private String sessionKey;

    /**
     * 操作名称（如 createWorkflow / addNode）
     */
    @TableField("action")
    private String action;

    /**
     * 策略：always / confirm / forbid
     */
    @TableField("policy")
    private String policy;
}
