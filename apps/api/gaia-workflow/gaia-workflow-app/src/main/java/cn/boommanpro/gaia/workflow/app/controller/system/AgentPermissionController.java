package cn.boommanpro.gaia.workflow.app.controller.system;

import cn.boommanpro.gaia.workflow.app.domain.agent.input.PermissionUpdateInput;
import cn.boommanpro.gaia.workflow.app.service.AgentToolRegistry;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentPermission;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentPermissionService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Agent 权限习惯管理
 */
@RestController
@RequestMapping("/api/agent/permission")
public class AgentPermissionController {

    private final AgentPermissionService permissionService;
    private final AgentToolRegistry toolRegistry;

    public AgentPermissionController(AgentPermissionService permissionService,
                                    AgentToolRegistry toolRegistry) {
        this.permissionService = permissionService;
        this.toolRegistry = toolRegistry;
    }

    /**
     * 获取会话的权限配置（合并默认值 + 用户自定义）
     */
    @GetMapping("/{sessionKey}")
    public Map<String, String> getPermissions(@PathVariable String sessionKey) {
        List<AgentPermission> perms = permissionService.list(
            new QueryWrapper<AgentPermission>().eq("session_key", sessionKey));
        Map<String, String> result = new HashMap<>(toolRegistry.getAllDefaultPolicies());
        for (AgentPermission p : perms) {
            result.put(p.getAction(), p.getPolicy());
        }
        return result;
    }

    /**
     * 更新某 action 的权限策略
     */
    @PutMapping
    public boolean updatePermission(@RequestBody PermissionUpdateInput input) {
        AgentPermission existing = permissionService.getOne(
            new QueryWrapper<AgentPermission>()
                .eq("session_key", input.getSessionKey())
                .eq("action", input.getAction()));
        if (existing != null) {
            existing.setPolicy(input.getPolicy());
            return permissionService.updateById(existing);
        }
        AgentPermission p = new AgentPermission();
        p.setSessionKey(input.getSessionKey());
        p.setAction(input.getAction());
        p.setPolicy(input.getPolicy());
        return permissionService.save(p);
    }

    /**
     * 获取所有 action 的默认策略
     */
    @GetMapping("/defaults")
    public Map<String, String> getDefaults() {
        return toolRegistry.getAllDefaultPolicies();
    }
}
