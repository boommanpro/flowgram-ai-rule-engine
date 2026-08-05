package cn.boommanpro.gaia.workflow.infra.manage.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

/**
 * Agent 知识图谱 - 边
 */
@Data
@TableName("agent_graph_edge")
public class AgentGraphEdge {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("source_key")
    private String sourceKey;

    @TableField("target_key")
    private String targetKey;

    @TableField("edge_type")
    private String edgeType;

    @TableField("properties")
    private String properties;

    @TableField("created_at")
    private String createdAt;

    @TableField("is_deleted")
    @TableLogic
    private Integer isDeleted;
}
