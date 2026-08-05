package cn.boommanpro.gaia.workflow.infra.manage.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGraphNode;
import cn.boommanpro.gaia.workflow.infra.manage.mapper.AgentGraphNodeMapper;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentGraphNodeService;
import org.springframework.stereotype.Service;

/**
 * Agent 知识图谱节点 Service 实现
 */
@Service
public class AgentGraphNodeServiceImpl extends ServiceImpl<AgentGraphNodeMapper, AgentGraphNode> implements AgentGraphNodeService {
}
