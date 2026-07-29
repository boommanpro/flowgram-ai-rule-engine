package cn.boommanpro.gaia.workflow.app.domain.agent.input;

import lombok.Data;

/**
 * 重命名会话请求
 */
@Data
public class SessionRenameInput {
    private String sessionKey;
    private String title;
}
