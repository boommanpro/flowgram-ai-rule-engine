package cn.boommanpro.gaia.workflow.app.service;

import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Agent 工具注册中心
 * 定义所有可调用工具的 OpenAI function calling schema
 */
@Component
public class AgentToolRegistry {

    private JSONArray toolsSchema;
    private String promptZh;
    private String promptEn;

    /**
     * action -> 默认权限策略
     * always: 自动执行；confirm: 每次确认；forbid: 禁止
     */
    private final Map<String, String> defaultPolicies = new HashMap<>();

    @PostConstruct
    public void init() throws IOException {
        toolsSchema = buildToolsSchema();
        promptZh = readResource("agent/prompt-zh.md");
        promptEn = readResource("agent/prompt-en.md");

        // 导航类 - 默认自动执行
        for (String a : new String[]{"goHome", "goAdmin", "goReleases", "goEditor", "goTemplateEditor"}) {
            defaultPolicies.put(a, "always");
        }
        // 查询类 - 默认自动执行
        for (String a : new String[]{"listWorkflows", "listTemplates", "listLogs", "getWorkflowDetail", "getNodeDetail"}) {
            defaultPolicies.put(a, "always");
        }
        // 写操作类 - 默认需确认
        for (String a : new String[]{"createWorkflow", "createTemplate", "saveWorkflow", "deleteWorkflow"}) {
            defaultPolicies.put(a, "confirm");
        }
        // 画布类 - 默认需确认
        for (String a : new String[]{"addNode", "updateNode", "deleteNode", "connect", "disconnect", "autoLayout"}) {
            defaultPolicies.put(a, "confirm");
        }
        // Plan 类 - 默认自动执行
        defaultPolicies.put("createPlan", "always");
    }

    public JSONArray getToolsSchema() {
        return toolsSchema;
    }

    public String getSystemPrompt(String locale, String pageContext) {
        String prompt = "zh-CN".equals(locale) ? promptZh : promptEn;
        if (pageContext != null && !pageContext.isEmpty()) {
            prompt += "\n\n## 当前页面上下文\n```json\n" + pageContext + "\n```";
        }
        return prompt;
    }

    public String getDefaultPolicy(String action) {
        return defaultPolicies.getOrDefault(action, "confirm");
    }

    public Map<String, String> getAllDefaultPolicies() {
        return defaultPolicies;
    }

    private String readResource(String path) throws IOException {
        ClassPathResource resource = new ClassPathResource(path);
        try (java.io.InputStream is = resource.getInputStream()) {
            java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
            byte[] data = new byte[4096];
            int n;
            while ((n = is.read(data, 0, data.length)) != -1) {
                buffer.write(data, 0, n);
            }
            return new String(buffer.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private JSONArray buildToolsSchema() {
        JSONArray tools = new JSONArray();

        // ===== 导航类 =====
        tools.add(func("goHome", "跳转到首页", obj(new String[0], new JSONObject[0])));
        tools.add(func("goAdmin", "跳转到管理后台，可选指定标签页", obj(
            new String[]{"tab"}, new JSONObject[]{str("tab", "标签页：workflows 或 templates", null)}
        )));
        tools.add(func("goReleases", "跳转到更新记录页", obj(new String[0], new JSONObject[0])));
        tools.add(func("goEditor", "跳转到工作流编辑器，可选指定 workflowCode", obj(
            new String[]{"workflowCode"}, new JSONObject[]{str("workflowCode", "工作流编码", null)}
        )));
        tools.add(func("goTemplateEditor", "跳转到模板编辑器，需指定 templateCode", obj(
            new String[]{"templateCode"}, new JSONObject[]{str("templateCode", "模板编码", null)}
        )));

        // ===== 查询类 =====
        tools.add(func("listWorkflows", "获取所有工作流列表", obj(new String[0], new JSONObject[0])));
        tools.add(func("listTemplates", "获取所有模板列表", obj(new String[0], new JSONObject[0])));
        tools.add(func("listLogs", "获取指定工作流的调用日志", obj(
            new String[]{"workflowCode"}, new JSONObject[]{str("workflowCode", "工作流编码", null)}
        )));
        tools.add(func("getWorkflowDetail", "获取工作流详情含画布数据", obj(
            new String[]{"workflowCode"}, new JSONObject[]{str("workflowCode", "工作流编码", null)}
        )));
        tools.add(func("getNodeDetail", "获取画布中指定节点的详细数据", obj(
            new String[]{"nodeId"}, new JSONObject[]{str("nodeId", "节点ID", null)}
        )));

        // ===== 写操作类 =====
        tools.add(func("createWorkflow", "创建新工作流", obj(
            new String[]{"name"}, new JSONObject[]{
                str("name", "工作流名称", null),
                str("desc", "工作流描述", null),
                str("templateCode", "基于模板创建（可选）", null)
            }
        )));
        tools.add(func("createTemplate", "创建新模板", obj(
            new String[]{"name"}, new JSONObject[]{
                str("name", "模板名称", null),
                str("desc", "模板描述", null)
            }
        )));
        tools.add(func("saveWorkflow", "保存当前画布到后端", obj(
            new String[]{"workflowCode"}, new JSONObject[]{str("workflowCode", "工作流编码", null)}
        )));
        tools.add(func("deleteWorkflow", "删除工作流", obj(
            new String[]{"id"}, new JSONObject[]{str("id", "工作流ID", null)}
        )));

        // ===== 画布类 =====
        tools.add(func("addNode", "在画布上添加节点", obj(
            new String[]{"type"}, new JSONObject[]{
                str("type", "节点类型", enumVal("start", "end", "llm", "code", "http", "condition", "branches", "loop", "variable", "string-format", "assignee", "comment")),
                str("afterNodeId", "在此节点之后添加（可选）", null),
                str("title", "节点标题（可选）", null),
                objProp("data", "节点数据，只填关键字段，其余由系统补默认值")
            }
        )));
        tools.add(func("updateNode", "更新画布中已有节点的数据", obj(
            new String[]{"nodeId", "data"}, new JSONObject[]{
                str("nodeId", "节点ID", null),
                objProp("data", "要更新的节点数据字段（patch）")
            }
        )));
        tools.add(func("deleteNode", "删除画布中的节点", obj(
            new String[]{"nodeId"}, new JSONObject[]{str("nodeId", "节点ID", null)}
        )));
        tools.add(func("connect", "连接两个节点", obj(
            new String[]{"from", "to"}, new JSONObject[]{
                str("from", "源节点ID", null),
                str("to", "目标节点ID", null),
                str("fromPort", "源端口（可选，用于分支/条件节点）", null)
            }
        )));
        tools.add(func("disconnect", "断开两个节点的连接", obj(
            new String[]{"from", "to"}, new JSONObject[]{
                str("from", "源节点ID", null),
                str("to", "目标节点ID", null)
            }
        )));
        tools.add(func("autoLayout", "自动排列画布节点", obj(new String[0], new JSONObject[0])));

        // ===== Plan 类 =====
        tools.add(func("createPlan", "创建多步骤执行计划，用于复杂任务（如创建完整 workflow）", obj(
            new String[]{"steps"}, new JSONObject[]{
                arrProp("steps", "执行步骤数组",
                    obj(new String[]{"intent", "action"}, new JSONObject[]{
                        str("intent", "该步骤的意图说明", null),
                        str("action", "要执行的工具名称", null),
                        objProp("args", "工具参数")
                    }))
            }
        )));

        return tools;
    }

    // ===== 辅助方法 =====

    private JSONObject func(String name, String desc, JSONObject params) {
        return new JSONObject()
            .set("type", "function")
            .set("function", new JSONObject()
                .set("name", name)
                .set("description", desc)
                .set("parameters", params));
    }

    /**
     * 构建 object 类型 parameters
     * @param required 必填属性名数组
     * @param props    对应的属性 schema 数组（与 required 顺序无关，按名匹配）
     */
    private JSONObject obj(String[] required, JSONObject[] props) {
        JSONObject properties = new JSONObject();
        for (JSONObject prop : props) {
            if (prop != null && prop.containsKey("__name")) {
                String name = prop.getStr("__name");
                prop.remove("__name");
                properties.set(name, prop);
            }
        }
        JSONObject result = new JSONObject()
            .set("type", "object")
            .set("properties", properties);
        if (required != null && required.length > 0) {
            result.set("required", JSONUtil.parseArray(java.util.Arrays.asList(required)));
        }
        return result;
    }

    private JSONObject str(String name, String desc, JSONObject extra) {
        JSONObject p = new JSONObject().set("__name", name).set("type", "string");
        if (desc != null) p.set("description", desc);
        if (extra != null) p.putAll(extra);
        return p;
    }

    private JSONObject enumVal(String... values) {
        JSONObject p = new JSONObject();
        p.set("enum", JSONUtil.parseArray(java.util.Arrays.asList(values)));
        return p;
    }

    private JSONObject objProp(String name, String desc) {
        return new JSONObject().set("__name", name).set("type", "object").set("description", desc);
    }

    private JSONObject arrProp(String name, String desc, JSONObject items) {
        JSONObject p = new JSONObject().set("__name", name).set("type", "array").set("description", desc);
        if (items != null) p.set("items", items);
        return p;
    }
}
