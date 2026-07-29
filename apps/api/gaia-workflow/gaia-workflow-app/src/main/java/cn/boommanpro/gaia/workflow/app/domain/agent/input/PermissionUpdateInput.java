package cn.boommanpro.gaia.workflow.app.domain.agent.input;

import lombok.Data;

/**
 * 更新权限请求
 */
@Data
public class PermissionUpdateInput {
    private String sessionKey;
    private String action;
    /**
     * always / confirm / forbid
     */
    private String policy;
}
