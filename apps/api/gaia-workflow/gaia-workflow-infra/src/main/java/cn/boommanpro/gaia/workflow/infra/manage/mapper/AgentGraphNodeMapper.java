package cn.boommanpro.gaia.workflow.infra.manage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGraphNode;
import org.apache.ibatis.annotations.Mapper;

/**
 * Agent 知识图谱节点 Mapper
 */
@Mapper
public interface AgentGraphNodeMapper extends BaseMapper<AgentGraphNode> {
}
