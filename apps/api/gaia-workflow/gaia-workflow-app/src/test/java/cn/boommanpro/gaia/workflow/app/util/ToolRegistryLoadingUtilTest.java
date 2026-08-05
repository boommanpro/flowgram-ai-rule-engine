package cn.boommanpro.gaia.workflow.app.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentToolDefinition;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("ToolRegistryLoadingUtil unit tests")
class ToolRegistryLoadingUtilTest {

    private static AgentToolDefinition def(String name, String description, String parameters,
                                           String defaultPolicy, String pageContexts, Integer enabled) {
        AgentToolDefinition d = new AgentToolDefinition();
        d.setToolName(name);
        d.setDescription(description);
        d.setParameters(parameters);
        d.setDefaultPolicy(defaultPolicy);
        d.setPageContexts(pageContexts);
        d.setEnabled(enabled);
        return d;
    }

    @Test
    @DisplayName("buildSchemaFromDefinitions: valid definitions → correct JSON structure")
    void buildSchemaValidDefinitions() {
        AgentToolDefinition d = def(
            "list_files",
            "List files in a directory",
            "{\"type\":\"object\",\"properties\":{\"path\":{\"type\":\"string\"}}}",
            "auto",
            null,
            1);

        JSONArray tools = ToolRegistryLoadingUtil.buildSchemaFromDefinitions(Collections.singletonList(d));

        assertEquals(1, tools.size());
        JSONObject tool = tools.getJSONObject(0);
        assertEquals("function", tool.getStr("type"));
        JSONObject fn = tool.getJSONObject("function");
        assertEquals("list_files", fn.getStr("name"));
        assertEquals("List files in a directory", fn.getStr("description"));
        JSONObject params = fn.getJSONObject("parameters");
        assertEquals("object", params.getStr("type"));
        assertTrue(params.containsKey("properties"));
    }

    @Test
    @DisplayName("buildSchemaFromDefinitions: null → empty JSONArray")
    void buildSchemaNullDefinitions() {
        JSONArray tools = ToolRegistryLoadingUtil.buildSchemaFromDefinitions(null);

        assertTrue(tools.isEmpty());
    }

    @Test
    @DisplayName("buildSchemaFromDefinitions: disabled tool → excluded")
    void buildSchemaDisabledExcluded() {
        AgentToolDefinition enabled = def("on_tool", "desc", "{}", "auto", null, 1);
        AgentToolDefinition disabled = def("off_tool", "desc", "{}", "auto", null, 0);

        JSONArray tools = ToolRegistryLoadingUtil.buildSchemaFromDefinitions(Arrays.asList(enabled, disabled));

        assertEquals(1, tools.size());
        assertEquals("on_tool", tools.getJSONObject(0).getJSONObject("function").getStr("name"));
    }

    @Test
    @DisplayName("buildSchemaFromDefinitions: invalid parameters JSON → fallback to empty object")
    void buildSchemaInvalidParametersFallback() {
        AgentToolDefinition d = def("bad_params", "desc", "not-json{", "auto", null, 1);

        JSONArray tools = ToolRegistryLoadingUtil.buildSchemaFromDefinitions(Collections.singletonList(d));

        assertEquals(1, tools.size());
        JSONObject params = tools.getJSONObject(0).getJSONObject("function").getJSONObject("parameters");
        assertEquals("object", params.getStr("type"));
        assertTrue(params.containsKey("properties"));
    }

    @Test
    @DisplayName("buildPoliciesFromDefinitions → correct map")
    void buildPoliciesCorrect() {
        AgentToolDefinition d1 = def("a", null, null, "auto", null, 1);
        AgentToolDefinition d2 = def("b", null, null, null, null, 1);

        Map<String, String> policies = ToolRegistryLoadingUtil.buildPoliciesFromDefinitions(Arrays.asList(d1, d2));

        assertEquals("auto", policies.get("a"));
        assertEquals("confirm", policies.get("b"));
    }

    @Test
    @DisplayName("filterByPageContext: null pageContexts → included for all pages")
    void filterNullPageContextsIncludedForAll() {
        AgentToolDefinition d = def("any_page", "desc", null, "auto", null, 1);

        List<AgentToolDefinition> home = ToolRegistryLoadingUtil.filterByPageContext(
            Collections.singletonList(d), "home");
        List<AgentToolDefinition> admin = ToolRegistryLoadingUtil.filterByPageContext(
            Collections.singletonList(d), "admin");

        assertEquals(1, home.size());
        assertEquals(1, admin.size());
    }

    @Test
    @DisplayName("filterByPageContext: pageContexts=[\"editor\"] + pageIdentifier=\"editor\" → included")
    void filterMatchingPageContextIncluded() {
        AgentToolDefinition d = def("editor_tool", "desc", null, "auto", "[\"editor\"]", 1);

        List<AgentToolDefinition> result = ToolRegistryLoadingUtil.filterByPageContext(
            Collections.singletonList(d), "editor");

        assertEquals(1, result.size());
        assertEquals("editor_tool", result.get(0).getToolName());
    }

    @Test
    @DisplayName("filterByPageContext: pageContexts=[\"editor\"] + pageIdentifier=\"admin\" → excluded")
    void filterNonMatchingPageContextExcluded() {
        AgentToolDefinition d = def("editor_tool", "desc", null, "auto", "[\"editor\"]", 1);

        List<AgentToolDefinition> result = ToolRegistryLoadingUtil.filterByPageContext(
            Collections.singletonList(d), "admin");

        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("needsSeeding: empty list → true")
    void needsSeedingEmpty() {
        assertTrue(ToolRegistryLoadingUtil.needsSeeding(Collections.emptyList()));
        assertTrue(ToolRegistryLoadingUtil.needsSeeding(null));
    }

    @Test
    @DisplayName("needsSeeding: non-empty list → false")
    void needsSeedingNonEmpty() {
        assertFalse(ToolRegistryLoadingUtil.needsSeeding(
            Collections.singletonList(def("x", null, null, null, null, 1))));
    }
}
