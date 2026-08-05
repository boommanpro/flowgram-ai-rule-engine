package cn.boommanpro.gaia.workflow.infra.manage.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentToolDefinition;
import cn.boommanpro.gaia.workflow.infra.manage.mapper.AgentToolDefinitionMapper;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentToolDefinitionService;
import org.springframework.stereotype.Service;

/**
 * Agent 工具定义 Service 实现
 */
@Service
public class AgentToolDefinitionServiceImpl extends ServiceImpl<AgentToolDefinitionMapper, AgentToolDefinition> implements AgentToolDefinitionService {
}
