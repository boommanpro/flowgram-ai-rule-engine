package cn.boommanpro.gaia.workflow.infra.manage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentMessage;
import org.apache.ibatis.annotations.Mapper;

/**
 * Agent 消息 Mapper
 */
@Mapper
public interface AgentMessageMapper extends BaseMapper<AgentMessage> {
}
