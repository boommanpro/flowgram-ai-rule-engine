package cn.boommanpro.gaia.workflow.infra.manage.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentConfig;
import cn.boommanpro.gaia.workflow.infra.manage.mapper.AgentConfigMapper;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentConfigService;
import org.springframework.stereotype.Service;

/**
 * Agent 配置 Service 实现
 */
@Service
public class AgentConfigServiceImpl extends ServiceImpl<AgentConfigMapper, AgentConfig> implements AgentConfigService {
}
