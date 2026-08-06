package cn.boommanpro.gaia.workflow.app.node;

import cn.boommanpro.gaia.workflow.app.domain.testrun.input.SingleNodeRunInput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.SingleNodeRunOutput;
import cn.boommanpro.gaia.workflow.app.executor.SingleNodeExecutor;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 维度三：Code 节点示例代码测试。
 * <p>
 * 加载 {@code code-examples/} 下的 Java / Groovy / JavaScript 示例源文件，
 * 动态构造 code 节点 JSON 并执行，确保知识库引用的示例代码始终可运行。
 * 这些示例文件同时是 AI Agent 知识库的源材料（见 node-knowledge.json）。
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 */
@DisplayName("Code 节点多语言示例测试")
class CodeNodeExamplesTest extends AbstractNodeTest {

    private final SingleNodeExecutor executor = new SingleNodeExecutor();

    private static final Map<String, Object> INPUTS = map("start_0", map("query", "Gaia"));

    @Test
    @DisplayName("Java 示例：实现 execute(Map) 方法，反射调用")
    void javaExample() {
        SingleNodeRunOutput out = runExample("java/ExampleCode.java", "java");
        assertTrue(out.isSuccess(), "Java 示例执行失败: " + out.getError());
        assertEquals("Hello, Gaia!", out.getOutputs().get("greeting").toString());
        assertEquals(4, ((Number) out.getOutputs().get("length")).intValue());
    }

    @Test
    @DisplayName("Groovy 示例：GroovyClassLoader 解析类")
    void groovyExample() {
        SingleNodeRunOutput out = runExample("groovy/ExampleCode.groovy", "groovy");
        assertTrue(out.isSuccess(), "Groovy 示例执行失败: " + out.getError());
        assertEquals("Hello, Gaia!", out.getOutputs().get("greeting").toString());
        assertEquals("GAIA", out.getOutputs().get("upper").toString());
    }

    @Test
    @DisplayName("JavaScript 示例：GraalJS 引擎执行")
    void javaScriptExample() {
        SingleNodeRunOutput out = runExample("javascript/ExampleCode.js", "javascript");
        assertTrue(out.isSuccess(), "JavaScript 示例执行失败: " + out.getError());
        assertEquals("Hello, Gaia!", out.getOutputs().get("greeting").toString());
        assertEquals(4, ((Number) out.getOutputs().get("length")).intValue());
    }

    // ==================== 辅助方法 ====================

    /**
     * 读取示例源文件，构造 code 节点 JSON 并执行。
     *
     * @param examplePath code-examples 下的相对路径
     * @param language    脚本语言
     */
    private SingleNodeRunOutput runExample(String examplePath, String language) {
        String code = readResource("/code-examples/" + examplePath);
        JSONObject nodeJson = buildCodeNodeJson(code, language);
        SingleNodeRunInput input = new SingleNodeRunInput();
        input.setNode(nodeJson.toString());
        input.setInputs(INPUTS);
        return executor.execute(input);
    }

    /**
     * 构造一个最小 code 节点 JSON：输入 name 引用 start_0.query，输出 greeting/length(upper)。
     */
    private static JSONObject buildCodeNodeJson(String code, String language) {
        JSONArray refContent = new JSONArray();
        refContent.add("start_0");
        refContent.add("query");
        JSONObject inputsValues = new JSONObject()
                .set("name", JSONUtil.createObj().set("type", "ref").set("content", refContent));

        JSONObject outputsProperties = new JSONObject()
                .set("greeting", JSONUtil.createObj().set("type", "string"))
                .set("length", JSONUtil.createObj().set("type", "number"))
                .set("upper", JSONUtil.createObj().set("type", "string"));

        JSONObject inputsProperties = new JSONObject()
                .set("name", JSONUtil.createObj().set("type", "string"));

        JSONObject data = JSONUtil.createObj()
                .set("title", "示例代码节点")
                .set("script", JSONUtil.createObj().set("language", language).set("content", code))
                .set("inputsValues", inputsValues)
                .set("outputs", JSONUtil.createObj().set("type", "object").set("properties", outputsProperties))
                .set("inputs", JSONUtil.createObj().set("type", "object").set("properties", inputsProperties));

        return JSONUtil.createObj()
                .set("id", "code_example_0")
                .set("type", "code")
                .set("data", data);
    }

    private static Map<String, Object> map(String k, Object v) {
        Map<String, Object> m = new HashMap<>();
        m.put(k, v);
        return m;
    }
}
