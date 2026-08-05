package cn.boommanpro.gaia.workflow.app.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.AbstractMap;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("PermissionMergeUtil unit tests")
class PermissionMergeUtilTest {

    private static Map<String, String> mapOf(String... kv) {
        Map<String, String> m = new HashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(kv[i], kv[i + 1]);
        return m;
    }

    private static List<Map.Entry<String, String>> entries(String... kv) {
        java.util.List<Map.Entry<String, String>> list = new java.util.ArrayList<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            list.add(new AbstractMap.SimpleEntry<>(kv[i], kv[i + 1]));
        }
        return list;
    }

    @Test
    @DisplayName("merge: session overrides global overrides default")
    void mergeSessionOverridesGlobalOverridesDefault() {
        Map<String, String> defaults = mapOf("delete_file", "confirm");
        List<Map.Entry<String, String>> globals = entries("delete_file", "auto");
        List<Map.Entry<String, String>> sessions = entries("delete_file", "deny");

        Map<String, String> merged = PermissionMergeUtil.merge(defaults, globals, sessions);

        assertEquals("deny", merged.get("delete_file"));
    }

    @Test
    @DisplayName("merge: global overrides default when no session policy")
    void mergeGlobalOverridesDefault() {
        Map<String, String> defaults = mapOf("read_file", "confirm");
        List<Map.Entry<String, String>> globals = entries("read_file", "auto");
        List<Map.Entry<String, String>> sessions = Collections.emptyList();

        Map<String, String> merged = PermissionMergeUtil.merge(defaults, globals, sessions);

        assertEquals("auto", merged.get("read_file"));
    }

    @Test
    @DisplayName("merge: default used when neither session nor global")
    void mergeDefaultUsedWhenNoSessionNorGlobal() {
        Map<String, String> defaults = mapOf("list_files", "confirm");

        Map<String, String> merged = PermissionMergeUtil.merge(
            defaults, Collections.emptyList(), Collections.emptyList());

        assertEquals("confirm", merged.get("list_files"));
    }

    @Test
    @DisplayName("merge: empty maps handled gracefully")
    void mergeEmptyMaps() {
        Map<String, String> merged = PermissionMergeUtil.merge(
            new HashMap<>(), Collections.emptyList(), Collections.emptyList());

        assertTrue(merged.isEmpty());
    }

    @Test
    @DisplayName("merge: all three levels present for same action — session wins")
    void mergeAllThreeLevelsSessionWins() {
        Map<String, String> defaults = mapOf("act", "default-val");
        List<Map.Entry<String, String>> globals = entries("act", "global-val");
        List<Map.Entry<String, String>> sessions = entries("act", "session-val");

        Map<String, String> merged = PermissionMergeUtil.merge(defaults, globals, sessions);

        assertEquals("session-val", merged.get("act"));
    }

    @Test
    @DisplayName("merge: distinct keys at each level are all preserved")
    void mergeDistinctKeysPreserved() {
        Map<String, String> defaults = mapOf("d", "dv");
        List<Map.Entry<String, String>> globals = entries("g", "gv");
        List<Map.Entry<String, String>> sessions = entries("s", "sv");

        Map<String, String> merged = PermissionMergeUtil.merge(defaults, globals, sessions);

        assertEquals("dv", merged.get("d"));
        assertEquals("gv", merged.get("g"));
        assertEquals("sv", merged.get("s"));
    }

    @Test
    @DisplayName("resolve: session overrides global overrides default")
    void resolveSessionOverridesGlobalOverridesDefault() {
        Map<String, String> defaults = mapOf("act", "default-val");
        Map<String, String> globals = mapOf("act", "global-val");
        Map<String, String> sessions = mapOf("act", "session-val");

        assertEquals("session-val", PermissionMergeUtil.resolve("act", sessions, globals, defaults));
    }

    @Test
    @DisplayName("resolve: global overrides default when no session policy")
    void resolveGlobalOverridesDefault() {
        Map<String, String> defaults = mapOf("act", "default-val");
        Map<String, String> globals = mapOf("act", "global-val");

        assertEquals("global-val", PermissionMergeUtil.resolve("act", null, globals, defaults));
        assertEquals("global-val", PermissionMergeUtil.resolve("act", new HashMap<>(), globals, defaults));
    }

    @Test
    @DisplayName("resolve: default used when neither session nor global")
    void resolveDefaultUsed() {
        Map<String, String> defaults = mapOf("act", "default-val");

        assertEquals("default-val", PermissionMergeUtil.resolve("act", null, null, defaults));
    }

    @Test
    @DisplayName("resolve: unknown action returns 'confirm'")
    void resolveUnknownActionReturnsConfirm() {
        Map<String, String> defaults = mapOf("known", "auto");

        assertEquals("confirm", PermissionMergeUtil.resolve("unknown", null, null, defaults));
    }

    @Test
    @DisplayName("resolve: empty/null maps handled gracefully")
    void resolveEmptyMaps() {
        assertEquals("confirm",
            PermissionMergeUtil.resolve("anything", null, null, new HashMap<>()));
    }
}
