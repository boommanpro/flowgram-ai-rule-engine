package cn.boommanpro.gaia.workflow.app.service;

import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentConfig;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentToolDefinition;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentConfigService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentToolDefinitionService;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Agent 工具注册中心
 * 定义所有可调用工具的 OpenAI function calling schema
 *
 * DB-first 实现：工具定义优先从 agent_tool_definition 表加载，
 * 表为空时自动用硬编码 schema 建种；运行时可通过 {@link #refresh()} 热更新。
 */
@Slf4j
@Component
public class AgentToolRegistry {

    private final AgentToolDefinitionService toolDefinitionService;
    private final AgentConfigService configService;

    private JSONArray toolsSchema;
    private String promptZh;
    private String promptEn;

    /**
     * 当前已加载（enabled）的工具定义，供控制器 / 页面上下文过滤使用
     */
    private List<AgentToolDefinition> toolDefinitions = new ArrayList<>();

    /**
     * action -> 默认权限策略
     * always: 自动执行；confirm: 每次确认；forbid: 禁止
     */
    private final Map<String, String> defaultPolicies = new HashMap<>();

    public AgentToolRegistry(AgentToolDefinitionService toolDefinitionService,
                             AgentConfigService configService) {
        this.toolDefinitionService = toolDefinitionService;
        this.configService = configService;
    }

    @PostConstruct
    public void init() throws IOException {
        // classpath 文件作为兜底默认值
        promptZh = readResource("agent/prompt-zh.md");
        promptEn = readResource("agent/prompt-en.md");
        loadFromDatabase();
        loadSystemPromptFromDb();
    }

    /**
     * 从 agent_config 表加载系统提示词，覆盖 classpath 默认值
     * configType=system_prompt，configKey=system_prompt.default
     */
    private void loadSystemPromptFromDb() {
        try {
            AgentConfig config = configService.getOne(
                new QueryWrapper<AgentConfig>()
                    .eq("config_key", "system_prompt.default")
                    .eq("config_type", "system_prompt"));
            if (config != null && config.getContent() != null && !config.getContent().isEmpty()) {
                promptZh = config.getContent();
                log.info("Loaded system prompt from DB ({} chars)", config.getContent().length());
            }
            // 英文版
            AgentConfig configEn = configService.getOne(
                new QueryWrapper<AgentConfig>()
                    .eq("config_key", "system_prompt.default.en")
                    .eq("config_type", "system_prompt"));
            if (configEn != null && configEn.getContent() != null && !configEn.getContent().isEmpty()) {
                promptEn = configEn.getContent();
                log.info("Loaded EN system prompt from DB ({} chars)", configEn.getContent().length());
            }
        } catch (Exception e) {
            log.warn("Failed to load system prompt from DB, using classpath fallback: {}", e.getMessage());
        }
    }

    /**
     * 热刷新系统提示词（管理后台保存后触发）
     */
    public void refreshSystemPrompt() {
        loadSystemPromptFromDb();
    }

    /**
     * 从数据库加载工具定义（首次加载允许自动建种）
     */
    private void loadFromDatabase() {
        loadFromDatabase(true);
    }

    /**
     * 旧版 21 个独立工具名（迁移检测用）
     */
    private static final String[] OLD_TOOL_NAMES = {
        "goHome", "goAdmin", "goReleases", "goEditor", "goTemplateEditor",
        "listWorkflows", "listTemplates", "listLogs", "getWorkflowDetail", "getNodeDetail",
        "createWorkflow", "createTemplate", "saveWorkflow", "deleteWorkflow",
        "addNode", "updateNode", "deleteNode", "connect", "disconnect", "autoLayout"
    };

    /**
     * 从数据库加载工具定义
     *
     * @param allowSeed 表为空时是否自动建种（首次启动允许，热刷新不允许）
     */
    private void loadFromDatabase(boolean allowSeed) {
        try {
            // 1. 迁移检测：删除所有旧版独立工具（仅删除旧工具名，不影响新复合工具）
            if (allowSeed) {
                int deleted = 0;
                for (String oldName : OLD_TOOL_NAMES) {
                    long cnt = toolDefinitionService.count(
                        new QueryWrapper<AgentToolDefinition>().eq("tool_name", oldName));
                    if (cnt > 0) {
                        toolDefinitionService.remove(
                            new QueryWrapper<AgentToolDefinition>().eq("tool_name", oldName));
                        deleted += cnt;
                    }
                }
                if (deleted > 0) {
                    log.info("Migrated: removed {} old individual tool definitions", deleted);
                }
            }

            // 2. 表为空时建种
            long total = toolDefinitionService.count();
            if (total == 0) {
                if (allowSeed) {
                    seedFromHardcoded();
                } else {
                    log.warn("Refresh skipped seeding: agent_tool_definition table is empty");
                }
            }

            // 3. 加载启用的工具定义
            List<AgentToolDefinition> enabled = toolDefinitionService.list(
                new QueryWrapper<AgentToolDefinition>()
                    .eq("enabled", 1)
                    .orderByAsc("sort_order", "id"));
            this.toolDefinitions = enabled;
            this.toolsSchema = buildSchemaFromDefinitions(enabled);

            this.defaultPolicies.clear();
            for (AgentToolDefinition t : enabled) {
                if (t.getToolName() != null && t.getDefaultPolicy() != null) {
                    this.defaultPolicies.put(t.getToolName(), t.getDefaultPolicy());
                }
            }
            log.info("Loaded {} enabled tool definitions from DB", enabled.size());
        } catch (Exception e) {
            log.warn("Failed to load tool definitions from DB, falling back to hardcoded schema", e);
            this.toolsSchema = buildToolsSchema();
            this.toolDefinitions = new ArrayList<>();
            this.defaultPolicies.clear();
            this.defaultPolicies.putAll(buildDefaultPolicies());
        }
    }

    /**
     * 用硬编码 schema 对空表进行建种
     */
    private void seedFromHardcoded() {
        JSONArray hardcoded = buildToolsSchema();
        Map<String, String> policies = buildDefaultPolicies();
        int order = 0;
        for (Object item : hardcoded) {
            JSONObject tool = (JSONObject) item;
            JSONObject function = tool.getJSONObject("function");
            String name = function.getStr("name");
            String desc = function.getStr("description");
            JSONObject params = function.getJSONObject("parameters");

            AgentToolDefinition def = new AgentToolDefinition();
            def.setToolName(name);
            def.setToolGroup(toolGroupOf(name));
            def.setDescription(desc);
            def.setParameters(params != null ? params.toString() : new JSONObject().toString());
            def.setDefaultPolicy(policies.getOrDefault(name, "confirm"));
            def.setPageContexts(null);
            def.setEnabled(1);
            def.setSortOrder(order++);
            String now = LocalDateTime.now().toString();
            def.setCreatedAt(now);
            def.setUpdatedAt(now);
            toolDefinitionService.save(def);
        }
        log.info("Auto-seeded {} tool definitions into agent_tool_definition table", hardcoded.size());
    }

    /**
     * 热刷新：从数据库重新加载工具定义（不建种）
     */
    public void refresh() {
        loadFromDatabase(false);
    }

    public JSONArray getToolsSchema() {
        return toolsSchema;
    }

    /**
     * 按页面上下文过滤工具 schema
     *
     * @param pageContext 页面上下文 JSON 字符串，需包含 route 字段
     * @return 过滤后的工具 schema；pageContext 为空时返回全部
     */
    public JSONArray getToolsSchema(String pageContext) {
        if (pageContext == null || pageContext.isEmpty()) {
            return getToolsSchema();
        }
        String pageId = resolvePageIdentifier(pageContext);
        JSONArray filtered = new JSONArray();
        for (Object item : toolsSchema) {
            JSONObject tool = (JSONObject) item;
            String name = tool.getJSONObject("function").getStr("name");
            AgentToolDefinition def = findDefinition(name);
            if (def == null || appliesToPage(def, pageId)) {
                filtered.add(tool);
            }
        }
        return filtered;
    }

    public List<AgentToolDefinition> getToolDefinitions() {
        return toolDefinitions;
    }

    public String getSystemPrompt(String locale, String pageContext) {
        // 每次调用从 DB 读取最新内容，确保管理后台修改即时生效
        String prompt = loadPromptFromDb(locale);
        if (pageContext != null && !pageContext.isEmpty()) {
            prompt += "\n\n## 当前页面上下文\n```json\n" + pageContext + "\n```";
        }
        return prompt;
    }

    /**
     * 从 DB 加载系统提示词，DB 无记录时 fallback 到 classpath 缓存
     */
    private String loadPromptFromDb(String locale) {
        boolean isZh = "zh-CN".equals(locale);
        String configKey = isZh ? "system_prompt.default" : "system_prompt.default.en";
        try {
            AgentConfig config = configService.getOne(
                new QueryWrapper<AgentConfig>()
                    .eq("config_key", configKey)
                    .eq("config_type", "system_prompt"));
            if (config != null && config.getContent() != null && !config.getContent().isEmpty()) {
                return config.getContent();
            }
        } catch (Exception e) {
            log.warn("Failed to load system prompt from DB for locale {}: {}", locale, e.getMessage());
        }
        // fallback 到 classpath 缓存
        return isZh ? promptZh : promptEn;
    }

    public String getDefaultPolicy(String action) {
        return defaultPolicies.getOrDefault(action, "confirm");
    }

    public Map<String, String> getAllDefaultPolicies() {
        return defaultPolicies;
    }

    // ===== 内部：DB -> schema 构建 =====

    private JSONArray buildSchemaFromDefinitions(List<AgentToolDefinition> defs) {
        JSONArray tools = new JSONArray();
        for (AgentToolDefinition d : defs) {
            JSONObject params;
            try {
                params = (d.getParameters() != null && !d.getParameters().isEmpty())
                    ? JSONUtil.parseObj(d.getParameters())
                    : new JSONObject();
            } catch (Exception e) {
                log.warn("Failed to parse parameters for tool [{}]: {}", d.getToolName(), e.getMessage());
                params = new JSONObject();
            }
            JSONObject entry = new JSONObject()
                .set("type", "function")
                .set("function", new JSONObject()
                    .set("name", d.getToolName())
                    .set("description", d.getDescription())
                    .set("parameters", params));
            tools.add(entry);
        }
        return tools;
    }

    private AgentToolDefinition findDefinition(String toolName) {
        if (toolDefinitions == null) {
            return null;
        }
        for (AgentToolDefinition d : toolDefinitions) {
            if (toolName.equals(d.getToolName())) {
                return d;
            }
        }
        return null;
    }

    private boolean appliesToPage(AgentToolDefinition def, String pageId) {
        String ctx = def.getPageContexts();
        if (ctx == null || ctx.trim().isEmpty()) {
            return true;
        }
        try {
            JSONArray arr = JSONUtil.parseArray(ctx);
            return arr.contains(pageId);
        } catch (Exception e) {
            log.warn("Failed to parse pageContexts for tool [{}]: {}", def.getToolName(), e.getMessage());
            return true;
        }
    }

    private String resolvePageIdentifier(String pageContext) {
        try {
            JSONObject ctx = JSONUtil.parseObj(pageContext);
            String route = ctx.getStr("route");
            if (route == null || route.isEmpty()) {
                return "other";
            }
            return routeToPageId(route);
        } catch (Exception e) {
            return "other";
        }
    }

    private String routeToPageId(String route) {
        if ("/".equals(route)) {
            return "home";
        }
        if ("/admin".equals(route) || route.startsWith("/admin/")) {
            return "admin";
        }
        if ("/editor".equals(route) || route.startsWith("/editor/")) {
            return "editor";
        }
        if ("/releases".equals(route)) {
            return "releases";
        }
        return "other";
    }

    private String toolGroupOf(String toolName) {
        if (toolName == null) {
            return "other";
        }
        switch (toolName) {
            case "navigate":
                return "navigation";
            case "query":
                return "query";
            case "manage":
                return "write";
            case "canvas":
                return "canvas";
            case "createPlan":
                return "plan";
            default:
                return "other";
        }
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

    // ===== 硬编码种子 schema（DB 为空时建种使用） =====

    private Map<String, String> buildDefaultPolicies() {
        Map<String, String> policies = new HashMap<>();
        // 复合工具策略
        policies.put("navigate", "always");
        policies.put("query", "always");
        policies.put("manage", "confirm");
        policies.put("canvas", "confirm");
        policies.put("createPlan", "always");
        return policies;
    }

    private JSONArray buildToolsSchema() {
        JSONArray tools = new JSONArray();

        // ===== 1. 导航复合工具 =====
        tools.add(func("navigate", "页面导航。支持跳转到首页、管理后台、更新记录、工作流编辑器、模板编辑器", obj(
            new String[]{"target"}, new JSONObject[]{
                str("target", "导航目标", enumVal("home", "admin", "releases", "editor", "templateEditor")),
                str("workflowCode", "工作流编码（target=editor时使用）", null),
                str("templateCode", "模板编码（target=templateEditor时使用）", null),
                str("tab", "管理后台标签页：workflows 或 templates（target=admin时使用）", null)
            }
        )));

        // ===== 2. 查询复合工具 =====
        tools.add(func("query", "查询资源。支持工作流列表、模板列表、调用日志、工作流详情、节点详情、可用变量", obj(
            new String[]{"resource"}, new JSONObject[]{
                str("resource", "查询的资源类型", enumVal("workflows", "templates", "logs", "workflowDetail", "nodeDetail", "availableVariables")),
                str("workflowCode", "工作流编码（resource=logs或workflowDetail时使用）", null),
                str("nodeId", "节点ID（resource=nodeDetail时使用）", null)
            }
        )));

        // ===== 3. 管理复合工具 =====
        tools.add(func("manage", "管理资源。支持创建工作流、创建模板、保存工作流、删除工作流", obj(
            new String[]{"action"}, new JSONObject[]{
                str("action", "管理操作", enumVal("createWorkflow", "createTemplate", "saveWorkflow", "deleteWorkflow")),
                str("name", "名称（创建时使用）", null),
                str("desc", "描述（创建时使用）", null),
                str("workflowCode", "工作流编码（saveWorkflow时使用）", null),
                str("templateCode", "模板编码（createWorkflow时可选使用）", null),
                str("id", "工作流ID（deleteWorkflow时使用）", null)
            }
        )));

        // ===== 4. 画布复合工具 =====
        tools.add(func("canvas", "画布操作。支持添加节点、更新节点、删除节点、连接节点、断开连接、自动布局、运行工作流、运行单节点", obj(
            new String[]{"action"}, new JSONObject[]{
                str("action", "画布操作类型", enumVal("addNode", "updateNode", "deleteNode", "connect", "disconnect", "autoLayout", "runWorkflow", "runNode")),
                str("type", "节点类型（action=addNode时使用）", enumVal("start", "end", "llm", "code", "http", "condition", "branches", "loop", "variable", "string-format", "assignee", "comment")),
                str("nodeId", "节点ID（updateNode/deleteNode/runNode时使用）", null),
                str("afterNodeId", "在此节点之后添加（action=addNode时可选使用）", null),
                str("title", "节点标题（action=addNode时可选使用）", null),
                objProp("data", "节点数据（addNode/updateNode时使用，只填关键字段）"),
                str("from", "源节点ID（connect/disconnect时使用）", null),
                str("to", "目标节点ID（connect/disconnect时使用）", null),
                str("fromPort", "源端口（connect时可选，用于分支/条件节点）", null),
                objProp("inputs", "运行输入参数（runWorkflow/runNode时使用）")
            }
        )));

        // ===== 5. 执行计划 =====
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
