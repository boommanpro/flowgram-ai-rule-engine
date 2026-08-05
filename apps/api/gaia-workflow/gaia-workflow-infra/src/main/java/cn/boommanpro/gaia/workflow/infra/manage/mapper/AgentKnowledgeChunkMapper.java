package cn.boommanpro.gaia.workflow.infra.manage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentKnowledgeChunk;
import org.apache.ibatis.annotations.Mapper;

/**
 * Agent RAG 知识库分块 Mapper
 */
@Mapper
public interface AgentKnowledgeChunkMapper extends BaseMapper<AgentKnowledgeChunk> {
}
