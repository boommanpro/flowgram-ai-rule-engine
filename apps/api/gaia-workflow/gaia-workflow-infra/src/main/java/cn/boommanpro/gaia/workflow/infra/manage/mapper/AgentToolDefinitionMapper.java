package cn.boommanpro.gaia.workflow.infra.manage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentToolDefinition;
import org.apache.ibatis.annotations.Mapper;

/**
 * Agent 工具定义 Mapper
 */
@Mapper
public interface AgentToolDefinitionMapper extends BaseMapper<AgentToolDefinition> {
}
