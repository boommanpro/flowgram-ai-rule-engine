package cn.boommanpro.gaia.workflow.app.controller.system;

import cn.boommanpro.gaia.workflow.app.domain.agent.input.SessionCreateInput;
import cn.boommanpro.gaia.workflow.app.domain.agent.input.SessionRenameInput;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentMessage;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentSession;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentMessageService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentSessionService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Agent 会话管理
 */
@RestController
@RequestMapping("/api/agent/session")
public class AgentSessionController {

    private final AgentSessionService sessionService;
    private final AgentMessageService messageService;

    public AgentSessionController(AgentSessionService sessionService,
                                  AgentMessageService messageService) {
        this.sessionService = sessionService;
        this.messageService = messageService;
    }

    @GetMapping("/list")
    public List<AgentSession> listSessions() {
        return sessionService.list(
            new QueryWrapper<AgentSession>().orderByDesc("created_at"));
    }

    @PostMapping("/create")
    public AgentSession createSession(@RequestBody SessionCreateInput input) {
        AgentSession session = new AgentSession();
        session.setSessionKey(UUID.randomUUID().toString().replace("-", ""));
        session.setTitle(input.getTitle() != null ? input.getTitle() : "新对话");
        session.setCreatedAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());
        sessionService.save(session);
        return session;
    }

    @PutMapping("/rename")
    public boolean renameSession(@RequestBody SessionRenameInput input) {
        AgentSession session = sessionService.getOne(
            new QueryWrapper<AgentSession>().eq("session_key", input.getSessionKey()));
        if (session == null) {
            return false;
        }
        session.setTitle(input.getTitle());
        session.setUpdatedAt(LocalDateTime.now());
        return sessionService.updateById(session);
    }

    @DeleteMapping("/{sessionKey}")
    public boolean deleteSession(@PathVariable String sessionKey) {
        return sessionService.remove(
            new QueryWrapper<AgentSession>().eq("session_key", sessionKey));
    }

    @GetMapping("/{sessionKey}/messages")
    public List<AgentMessage> getMessages(@PathVariable String sessionKey) {
        return messageService.list(
            new QueryWrapper<AgentMessage>()
                .eq("session_key", sessionKey)
                .orderByAsc("id"));
    }
}
