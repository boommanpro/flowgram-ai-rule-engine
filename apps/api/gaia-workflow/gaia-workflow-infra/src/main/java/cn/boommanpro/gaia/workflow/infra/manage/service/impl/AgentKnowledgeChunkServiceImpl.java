package cn.boommanpro.gaia.workflow.infra.manage.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentKnowledgeChunk;
import cn.boommanpro.gaia.workflow.infra.manage.mapper.AgentKnowledgeChunkMapper;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentKnowledgeChunkService;
import org.springframework.stereotype.Service;

/**
 * Agent RAG 知识库分块 Service 实现
 */
@Service
public class AgentKnowledgeChunkServiceImpl extends ServiceImpl<AgentKnowledgeChunkMapper, AgentKnowledgeChunk> implements AgentKnowledgeChunkService {
}
