package cn.boommanpro.gaia.workflow.infra.manage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentSession;
import org.apache.ibatis.annotations.Mapper;

/**
 * Agent 会话 Mapper
 */
@Mapper
public interface AgentSessionMapper extends BaseMapper<AgentSession> {
}
