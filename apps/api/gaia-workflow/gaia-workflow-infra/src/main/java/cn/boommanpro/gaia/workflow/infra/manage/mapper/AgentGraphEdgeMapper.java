package cn.boommanpro.gaia.workflow.infra.manage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGraphEdge;
import org.apache.ibatis.annotations.Mapper;

/**
 * Agent 知识图谱边 Mapper
 */
@Mapper
public interface AgentGraphEdgeMapper extends BaseMapper<AgentGraphEdge> {
}
