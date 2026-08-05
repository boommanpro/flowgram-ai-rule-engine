package cn.boommanpro.gaia.workflow.app.controller.api;

import cn.boommanpro.gaia.workflow.app.domain.agent.input.ChatInput;
import cn.boommanpro.gaia.workflow.app.domain.agent.input.ToolResultInput;
import cn.boommanpro.gaia.workflow.app.service.AgentChatService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Agent 对话 SSE 接口
 */
@RestController
@RequestMapping("/api/agent")
public class AgentChatController {

    private final AgentChatService chatService;

    public AgentChatController(AgentChatService chatService) {
        this.chatService = chatService;
    }

    /**
     * 对话（SSE 流式）
     */
    @PostMapping("/chat")
    public SseEmitter chat(@RequestBody ChatInput input) {
        SseEmitter emitter = new SseEmitter(0L);
        chatService.chat(emitter, input);
        return emitter;
    }

    /**
     * 工具结果回灌后继续对话（SSE 流式）
     */
    @PostMapping("/tool-result")
    public SseEmitter toolResult(@RequestBody ToolResultInput input) {
        SseEmitter emitter = new SseEmitter(0L);
        chatService.toolResult(emitter, input);
        return emitter;
    }

    /**
     * 压缩会话历史（SSE 流式）
     */
    @PostMapping("/compact")
    public SseEmitter compact(@RequestParam String sessionKey) {
        SseEmitter emitter = new SseEmitter(0L);
        chatService.compact(emitter, sessionKey);
        return emitter;
    }
}
