package cn.boommanpro.gaia.workflow.infra.manage.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGlobalPermission;
import cn.boommanpro.gaia.workflow.infra.manage.mapper.AgentGlobalPermissionMapper;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentGlobalPermissionService;
import org.springframework.stereotype.Service;

/**
 * Agent 全局默认权限 Service 实现
 */
@Service
public class AgentGlobalPermissionServiceImpl extends ServiceImpl<AgentGlobalPermissionMapper, AgentGlobalPermission> implements AgentGlobalPermissionService {
}
