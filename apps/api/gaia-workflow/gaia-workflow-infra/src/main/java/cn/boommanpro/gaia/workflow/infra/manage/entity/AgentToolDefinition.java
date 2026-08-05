package cn.boommanpro.gaia.workflow.infra.manage.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

/**
 * Agent 工具定义（动态管理）
 */
@Data
@TableName("agent_tool_definition")
public class AgentToolDefinition {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("tool_name")
    private String toolName;

    @TableField("tool_group")
    private String toolGroup;

    @TableField("description")
    private String description;

    @TableField("parameters")
    private String parameters;

    @TableField("default_policy")
    private String defaultPolicy;

    @TableField("page_contexts")
    private String pageContexts;

    @TableField("enabled")
    private Integer enabled;

    @TableField("sort_order")
    private Integer sortOrder;

    @TableField("created_at")
    private String createdAt;

    @TableField("updated_at")
    private String updatedAt;

    @TableField("is_deleted")
    @TableLogic
    private Integer isDeleted;
}
