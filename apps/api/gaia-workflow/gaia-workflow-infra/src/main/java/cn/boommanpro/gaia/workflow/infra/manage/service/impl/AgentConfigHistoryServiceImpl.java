package cn.boommanpro.gaia.workflow.infra.manage.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentConfigHistory;
import cn.boommanpro.gaia.workflow.infra.manage.mapper.AgentConfigHistoryMapper;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentConfigHistoryService;
import org.springframework.stereotype.Service;

/**
 * Agent 配置变更历史 Service 实现
 */
@Service
public class AgentConfigHistoryServiceImpl extends ServiceImpl<AgentConfigHistoryMapper, AgentConfigHistory> implements AgentConfigHistoryService {
}
