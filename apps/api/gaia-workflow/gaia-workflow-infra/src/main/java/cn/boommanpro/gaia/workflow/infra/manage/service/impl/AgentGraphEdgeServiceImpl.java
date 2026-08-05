package cn.boommanpro.gaia.workflow.infra.manage.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGraphEdge;
import cn.boommanpro.gaia.workflow.infra.manage.mapper.AgentGraphEdgeMapper;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentGraphEdgeService;
import org.springframework.stereotype.Service;

/**
 * Agent 知识图谱边 Service 实现
 */
@Service
public class AgentGraphEdgeServiceImpl extends ServiceImpl<AgentGraphEdgeMapper, AgentGraphEdge> implements AgentGraphEdgeService {
}
