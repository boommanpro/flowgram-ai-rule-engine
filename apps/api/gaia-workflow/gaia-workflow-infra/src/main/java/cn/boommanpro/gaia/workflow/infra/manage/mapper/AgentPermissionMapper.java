package cn.boommanpro.gaia.workflow.infra.manage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentPermission;
import org.apache.ibatis.annotations.Mapper;

/**
 * Agent 权限 Mapper
 */
@Mapper
public interface AgentPermissionMapper extends BaseMapper<AgentPermission> {
}
