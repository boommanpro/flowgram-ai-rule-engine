package cn.boommanpro.gaia.workflow.infra.manage.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

/**
 * Agent 配置中心：在线管理 Prompt / 节点知识文档 / LLM 参数
 */
@Data
@TableName("agent_config")
public class AgentConfig {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("config_key")
    private String configKey;

    @TableField("config_type")
    private String configType;

    @TableField("title")
    private String title;

    @TableField("content")
    private String content;

    @TableField("config_data")
    private String configData;

    @TableField("description")
    private String description;

    @TableField("created_at")
    private String createdAt;

    @TableField("updated_at")
    private String updatedAt;

    @TableField("is_deleted")
    @TableLogic
    private Integer isDeleted;
}
