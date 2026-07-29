package cn.boommanpro.gaia.workflow.infra.manage.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentPermission;
import cn.boommanpro.gaia.workflow.infra.manage.mapper.AgentPermissionMapper;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentPermissionService;
import org.springframework.stereotype.Service;

/**
 * Agent 权限 Service 实现
 */
@Service
public class AgentPermissionServiceImpl extends ServiceImpl<AgentPermissionMapper, AgentPermission> implements AgentPermissionService {
}
