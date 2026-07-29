package cn.boommanpro.gaia.workflow.infra.manage.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentMessage;
import cn.boommanpro.gaia.workflow.infra.manage.mapper.AgentMessageMapper;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentMessageService;
import org.springframework.stereotype.Service;

/**
 * Agent 消息 Service 实现
 */
@Service
public class AgentMessageServiceImpl extends ServiceImpl<AgentMessageMapper, AgentMessage> implements AgentMessageService {
}
