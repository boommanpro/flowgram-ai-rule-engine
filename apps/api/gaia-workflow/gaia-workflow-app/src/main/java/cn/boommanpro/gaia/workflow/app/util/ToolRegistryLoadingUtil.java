package cn.boommanpro.gaia.workflow.app.util;

import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentToolDefinition;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ToolRegistryLoadingUtil {

    /**
     * Build tools schema JSON from DB tool definitions.
     *
     * @param definitions enabled tool definitions from DB
     * @return JSONArray of OpenAI function-calling tool schemas
     */
    public static JSONArray buildSchemaFromDefinitions(List<AgentToolDefinition> definitions) {
        JSONArray tools = new JSONArray();
        if (definitions == null) return tools;
        for (AgentToolDefinition def : definitions) {
            if (def.getEnabled() == null || def.getEnabled() != 1) continue;
            JSONObject params;
            try {
                params = JSONUtil.parseObj(def.getParameters());
            } catch (Exception e) {
                params = new JSONObject().set("type", "object").set("properties", new JSONObject());
            }
            JSONObject tool = new JSONObject()
                .set("type", "function")
                .set("function", new JSONObject()
                    .set("name", def.getToolName())
                    .set("description", def.getDescription() != null ? def.getDescription() : "")
                    .set("parameters", params));
            tools.add(tool);
        }
        return tools;
    }

    /**
     * Build default policies map from DB tool definitions.
     */
    public static Map<String, String> buildPoliciesFromDefinitions(List<AgentToolDefinition> definitions) {
        Map<String, String> policies = new HashMap<>();
        if (definitions == null) return policies;
        for (AgentToolDefinition def : definitions) {
            policies.put(def.getToolName(), def.getDefaultPolicy() != null ? def.getDefaultPolicy() : "confirm");
        }
        return policies;
    }

    /**
     * Filter tool definitions by page context.
     *
     * @param definitions    all tool definitions
     * @param pageIdentifier one of: "home", "admin", "editor", "releases", "other"
     * @return filtered list (tools with null pageContexts pass through; tools with pageContexts array must contain the identifier)
     */
    public static List<AgentToolDefinition> filterByPageContext(List<AgentToolDefinition> definitions, String pageIdentifier) {
        List<AgentToolDefinition> result = new ArrayList<>();
        if (definitions == null) return result;
        for (AgentToolDefinition def : definitions) {
            if (def.getEnabled() == null || def.getEnabled() != 1) continue;
            if (def.getPageContexts() == null || def.getPageContexts().isEmpty()) {
                result.add(def); // applies to all pages
                continue;
            }
            try {
                JSONArray contexts = JSONUtil.parseArray(def.getPageContexts());
                for (int i = 0; i < contexts.size(); i++) {
                    if (pageIdentifier.equals(contexts.getStr(i))) {
                        result.add(def);
                        break;
                    }
                }
            } catch (Exception e) {
                result.add(def); // if parse fails, include it
            }
        }
        return result;
    }

    /**
     * Determine if DB needs seeding (no rows at all).
     */
    public static boolean needsSeeding(List<AgentToolDefinition> definitions) {
        return definitions == null || definitions.isEmpty();
    }
}
