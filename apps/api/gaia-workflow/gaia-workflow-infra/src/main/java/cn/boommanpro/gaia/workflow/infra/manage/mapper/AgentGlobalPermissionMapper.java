package cn.boommanpro.gaia.workflow.infra.manage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGlobalPermission;
import org.apache.ibatis.annotations.Mapper;

/**
 * Agent 全局默认权限 Mapper
 */
@Mapper
public interface AgentGlobalPermissionMapper extends BaseMapper<AgentGlobalPermission> {
}
