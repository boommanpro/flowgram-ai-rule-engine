package cn.boommanpro.gaia.workflow.infra.manage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentConfigHistory;
import org.apache.ibatis.annotations.Mapper;

/**
 * Agent 配置变更历史 Mapper
 */
@Mapper
public interface AgentConfigHistoryMapper extends BaseMapper<AgentConfigHistory> {
}
