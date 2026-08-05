package cn.boommanpro.gaia.workflow.app.controller.system;

import cn.boommanpro.gaia.workflow.app.domain.agent.input.PermissionUpdateInput;
import cn.boommanpro.gaia.workflow.app.service.AgentToolRegistry;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGlobalPermission;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentPermission;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentGlobalPermissionService;
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
    private final AgentGlobalPermissionService globalPermissionService;
    private final AgentToolRegistry toolRegistry;

    public AgentPermissionController(AgentPermissionService permissionService,
                                    AgentGlobalPermissionService globalPermissionService,
                                    AgentToolRegistry toolRegistry) {
        this.permissionService = permissionService;
        this.globalPermissionService = globalPermissionService;
        this.toolRegistry = toolRegistry;
    }

    /**
     * 获取会话的权限配置（合并优先级：会话级 > 全局默认 > 工具注册表默认）
     */
    @GetMapping("/{sessionKey}")
    public Map<String, String> getPermissions(@PathVariable String sessionKey) {
        // Start with toolRegistry defaults (lowest priority)
        Map<String, String> result = new HashMap<>(toolRegistry.getAllDefaultPolicies());
        // Override with global defaults
        List<AgentGlobalPermission> globals = globalPermissionService.list(null);
        for (AgentGlobalPermission g : globals) {
            result.put(g.getAction(), g.getPolicy());
        }
        // Override with session-level (highest priority)
        List<AgentPermission> perms = permissionService.list(
            new QueryWrapper<AgentPermission>().eq("session_key", sessionKey));
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

    /**
     * 获取全局默认权限（合并工具注册表默认 + 全局覆盖）
     */
    @GetMapping("/global")
    public Map<String, String> getGlobalDefaults() {
        Map<String, String> result = new HashMap<>(toolRegistry.getAllDefaultPolicies());
        List<AgentGlobalPermission> globals = globalPermissionService.list(null);
        for (AgentGlobalPermission g : globals) {
            result.put(g.getAction(), g.getPolicy());
        }
        return result;
    }

    /**
     * 更新全局默认权限（sessionKey 字段被忽略）
     */
    @PutMapping("/global")
    public boolean updateGlobalPermission(@RequestBody PermissionUpdateInput input) {
        AgentGlobalPermission existing = globalPermissionService.getOne(
            new QueryWrapper<AgentGlobalPermission>().eq("action", input.getAction()));
        if (existing != null) {
            existing.setPolicy(input.getPolicy());
            return globalPermissionService.updateById(existing);
        }
        AgentGlobalPermission g = new AgentGlobalPermission();
        g.setAction(input.getAction());
        g.setPolicy(input.getPolicy());
        return globalPermissionService.save(g);
    }
}
