package cn.boommanpro.gaia.workflow.app.controller.api;

import cn.boommanpro.gaia.workflow.app.domain.agent.input.SubagentRunInput;
import cn.boommanpro.gaia.workflow.app.domain.agent.input.SubagentToolResultInput;
import cn.boommanpro.gaia.workflow.app.service.SubagentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Subagent 单节点调试 SSE 接口
 */
@RestController
@RequestMapping("/api/subagent")
public class SubagentController {

    private final SubagentService subagentService;

    public SubagentController(SubagentService subagentService) {
        this.subagentService = subagentService;
    }

    /**
     * 运行调试（SSE 流式）
     */
    @GetMapping("/run")
    public SseEmitter run(@RequestParam String sessionKey,
                          @RequestParam String message,
                          @RequestParam(required = false) String locale,
                          @RequestParam(required = false) String pageContext) {
        SseEmitter emitter = new SseEmitter(0L);
        SubagentRunInput input = new SubagentRunInput();
        input.setSessionKey(sessionKey);
        input.setMessage(message);
        input.setLocale(locale);
        input.setPageContext(pageContext);
        subagentService.run(emitter, input);
        return emitter;
    }

    /**
     * 工具结果回灌后继续调试（SSE 流式）
     */
    @PostMapping("/tool-result")
    public SseEmitter toolResult(@RequestBody SubagentToolResultInput input) {
        SseEmitter emitter = new SseEmitter(0L);
        subagentService.toolResult(emitter, input);
        return emitter;
    }
}
