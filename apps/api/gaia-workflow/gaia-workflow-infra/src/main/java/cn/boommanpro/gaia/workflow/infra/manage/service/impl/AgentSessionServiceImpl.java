package cn.boommanpro.gaia.workflow.infra.manage.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentSession;
import cn.boommanpro.gaia.workflow.infra.manage.mapper.AgentSessionMapper;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentSessionService;
import org.springframework.stereotype.Service;

/**
 * Agent 会话 Service 实现
 */
@Service
public class AgentSessionServiceImpl extends ServiceImpl<AgentSessionMapper, AgentSession> implements AgentSessionService {
}
