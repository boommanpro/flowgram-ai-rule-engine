package cn.boommanpro.gaia.workflow.infra.manage.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

/**
 * Agent 全局默认权限（跨会话生效）
 */
@Data
@TableName("agent_global_permission")
public class AgentGlobalPermission {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("action")
    private String action;

    @TableField("policy")
    private String policy;
}
