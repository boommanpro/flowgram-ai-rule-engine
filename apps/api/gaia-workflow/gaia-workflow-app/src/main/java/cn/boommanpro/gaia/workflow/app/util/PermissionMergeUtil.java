package cn.boommanpro.gaia.workflow.app.util;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PermissionMergeUtil {

    /**
     * Merge permission policies with priority: session-level > global > default.
     *
     * @param defaults     tool registry defaults (lowest priority)
     * @param globals      global default permissions
     * @param sessionPerms session-level permissions (highest priority)
     * @return merged policy map
     */
    public static Map<String, String> merge(
        Map<String, String> defaults,
        List<Map.Entry<String, String>> globals,
        List<Map.Entry<String, String>> sessionPerms
    ) {
        Map<String, String> result = new HashMap<>(defaults);
        for (Map.Entry<String, String> g : globals) result.put(g.getKey(), g.getValue());
        for (Map.Entry<String, String> s : sessionPerms) result.put(s.getKey(), s.getValue());
        return result;
    }

    /**
     * Resolve a single action's policy with priority: session > global > default.
     */
    public static String resolve(
        String action,
        Map<String, String> sessionPerms,
        Map<String, String> globals,
        Map<String, String> defaults
    ) {
        if (sessionPerms != null && sessionPerms.containsKey(action)) return sessionPerms.get(action);
        if (globals != null && globals.containsKey(action)) return globals.get(action);
        return defaults.getOrDefault(action, "confirm");
    }
}
