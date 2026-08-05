package cn.boommanpro.gaia.workflow.infra.manage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentConfig;
import org.apache.ibatis.annotations.Mapper;

/**
 * Agent 配置 Mapper
 */
@Mapper
public interface AgentConfigMapper extends BaseMapper<AgentConfig> {
}
