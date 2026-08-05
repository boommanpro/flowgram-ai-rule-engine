package cn.boommanpro.gaia.workflow.app.util;

import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentMessage;
import java.util.List;

public class MessageTruncationUtil {

    /**
     * Truncate message list so it starts at a user message boundary.
     * If the first message is not role=user, scan forward to find the first user message
     * and drop everything before it. This prevents dangling tool_calls/tool messages
     * at the start of the context window which cause LLM API 400 errors.
     *
     * @param msgs messages in chronological order (oldest first)
     * @return truncated list (may be same reference if no truncation needed)
     */
    public static List<AgentMessage> truncateAtUserBoundary(List<AgentMessage> msgs) {
        if (msgs == null || msgs.isEmpty()) return msgs;
        if ("user".equals(msgs.get(0).getRole())) return msgs;
        int firstUserIndex = -1;
        for (int i = 0; i < msgs.size(); i++) {
            if ("user".equals(msgs.get(i).getRole())) {
                firstUserIndex = i;
                break;
            }
        }
        if (firstUserIndex <= 0) return msgs; // -1 means no user msg, keep all; 0 already handled
        return msgs.subList(firstUserIndex, msgs.size());
    }
}
