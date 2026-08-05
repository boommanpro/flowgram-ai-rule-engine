package cn.boommanpro.gaia.workflow.app.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentMessage;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("MessageTruncationUtil unit tests")
class MessageTruncationUtilTest {

    private static AgentMessage msg(String role) {
        AgentMessage m = new AgentMessage();
        m.setRole(role);
        return m;
    }

    @Test
    @DisplayName("First message is user → no truncation (same reference)")
    void firstIsUserNoTruncation() {
        List<AgentMessage> msgs = Arrays.asList(msg("user"), msg("assistant"), msg("user"));

        List<AgentMessage> result = MessageTruncationUtil.truncateAtUserBoundary(msgs);

        assertSame(msgs, result);
        assertEquals(3, result.size());
    }

    @Test
    @DisplayName("assistant(tool_calls), tool, user → truncates to start at user")
    void truncatesToFirstUser() {
        List<AgentMessage> msgs = Arrays.asList(
            msg("assistant"), msg("tool"), msg("user"), msg("assistant"));

        List<AgentMessage> result = MessageTruncationUtil.truncateAtUserBoundary(msgs);

        assertEquals(2, result.size());
        assertEquals("user", result.get(0).getRole());
        assertEquals("assistant", result.get(1).getRole());
    }

    @Test
    @DisplayName("All messages are assistant/tool (no user) → no truncation (keep all)")
    void noUserKeepAll() {
        List<AgentMessage> msgs = Arrays.asList(msg("assistant"), msg("tool"), msg("assistant"));

        List<AgentMessage> result = MessageTruncationUtil.truncateAtUserBoundary(msgs);

        assertSame(msgs, result);
        assertEquals(3, result.size());
    }

    @Test
    @DisplayName("Empty list → returns empty list")
    void emptyListReturnsEmpty() {
        List<AgentMessage> msgs = Collections.emptyList();

        List<AgentMessage> result = MessageTruncationUtil.truncateAtUserBoundary(msgs);

        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("Null list → returns null")
    void nullListReturnsNull() {
        assertNull(MessageTruncationUtil.truncateAtUserBoundary(null));
    }

    @Test
    @DisplayName("Single non-user message → returns same list")
    void singleNonUserReturnsSame() {
        List<AgentMessage> msgs = Collections.singletonList(msg("assistant"));

        List<AgentMessage> result = MessageTruncationUtil.truncateAtUserBoundary(msgs);

        assertSame(msgs, result);
        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("tool, tool, user, assistant, user → starts from first user")
    void startsFromFirstUser() {
        List<AgentMessage> msgs = Arrays.asList(
            msg("tool"), msg("tool"), msg("user"), msg("assistant"), msg("user"));

        List<AgentMessage> result = MessageTruncationUtil.truncateAtUserBoundary(msgs);

        assertEquals(3, result.size());
        assertEquals("user", result.get(0).getRole());
        assertEquals("assistant", result.get(1).getRole());
        assertEquals("user", result.get(2).getRole());
    }
}
