package cn.boommanpro.gaia.workflow.infra.manage.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

/**
 * Agent 知识图谱 - 节点
 */
@Data
@TableName("agent_graph_node")
public class AgentGraphNode {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("node_key")
    private String nodeKey;

    @TableField("node_type")
    private String nodeType;

    @TableField("title")
    private String title;

    @TableField("properties")
    private String properties;

    @TableField("created_at")
    private String createdAt;

    @TableField("updated_at")
    private String updatedAt;

    @TableField("is_deleted")
    @TableLogic
    private Integer isDeleted;
}
