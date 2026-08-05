package cn.boommanpro.gaia.workflow.infra.manage.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

/**
 * Agent 配置变更历史（每次修改自动归档）
 */
@Data
@TableName("agent_config_history")
public class AgentConfigHistory {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("config_key")
    private String configKey;

    @TableField("version")
    private Integer version;

    @TableField("title")
    private String title;

    @TableField("content")
    private String content;

    @TableField("config_data")
    private String configData;

    @TableField("description")
    private String description;

    @TableField("changed_by")
    private String changedBy;

    @TableField("created_at")
    private String createdAt;
}
