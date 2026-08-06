package cn.boommanpro.gaia.workflow.app.node;

import cn.boommanpro.gaia.workflow.app.domain.testrun.input.SingleNodeRunInput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.SingleNodeRunOutput;
import cn.boommanpro.gaia.workflow.app.executor.SingleNodeExecutor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 维度二：JSON 驱动的单节点执行测试。
 * <p>
 * 模拟前端编辑器传入节点 JSON + 模拟内存上下文，由 {@link SingleNodeExecutor} 解析并执行，
 * 验证可执行节点（start/end/code/string-format/variable/condition）的端到端正确性。
 * 这是「前端传 JSON，后端完成单节点测试」能力的回归底座。
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 */
@DisplayName("JSON 驱动单节点执行测试")
class SingleNodeExecutionTest extends AbstractNodeTest {

    private final SingleNodeExecutor executor = new SingleNodeExecutor();

    /** start 节点的输入以顶层 key 注入（模拟工作流输入参数） */
    private static final Map<String, Object> START_INPUTS = map("query", "Hello Flow.");
    /** 下游节点通过 start_0.query 引用，故内存以 start_0 为 key */
    private static final Map<String, Object> DOWNSTREAM_INPUTS = map("start_0", map("query", "World"));
    /** condition 匹配场景：query 等于 fixture 中的常量 "Hello Flow." */
    private static final Map<String, Object> CONDITION_MATCH_INPUTS = map("start_0", map("query", "Hello Flow."));

    @Test
    @DisplayName("start: 返回注入的输入参数")
    void executeStartNode() {
        SingleNodeRunOutput out = run("start", "start", START_INPUTS);
        assertTrue(out.isSuccess());
        assertEquals("Hello Flow.", out.getOutputs().get("query"));
    }

    @Test
    @DisplayName("end: 解析 ref 引用 start_0.query")
    void executeEndNode() {
        SingleNodeRunOutput out = run("end", "end", DOWNSTREAM_INPUTS);
        assertTrue(out.isSuccess());
        assertEquals("World", out.getOutputs().get("output"));
    }

    @Test
    @DisplayName("code(java): 动态编译执行返回 greeting/length")
    void executeCodeJavaNode() {
        SingleNodeRunOutput out = run("code", "code-java", DOWNSTREAM_INPUTS);
        assertTrue(out.isSuccess(), "java 代码节点应执行成功, error=" + out.getError());
        assertEquals("Hello, World!", out.getOutputs().get("greeting").toString());
        assertEquals(5, ((Number) out.getOutputs().get("length")).intValue());
    }

    @Test
    @DisplayName("code(groovy): 动态编译执行返回 greeting/upper")
    void executeCodeGroovyNode() {
        SingleNodeRunOutput out = run("code", "code-groovy", DOWNSTREAM_INPUTS);
        assertTrue(out.isSuccess(), "groovy 代码节点应执行成功, error=" + out.getError());
        assertEquals("Hello, World!", out.getOutputs().get("greeting").toString());
        assertEquals("WORLD", out.getOutputs().get("upper").toString());
    }

    @Test
    @DisplayName("code(javascript): GraalJS 执行返回 greeting/length")
    void executeCodeJavaScriptNode() {
        SingleNodeRunOutput out = run("code", "code-js", DOWNSTREAM_INPUTS);
        assertTrue(out.isSuccess(), "javascript 代码节点应执行成功, error=" + out.getError());
        assertEquals("Hello, World!", out.getOutputs().get("greeting").toString());
        assertEquals(5, ((Number) out.getOutputs().get("length")).intValue());
    }

    @Test
    @DisplayName("string-format: SpEL 模板渲染")
    void executeStringFormatNode() {
        SingleNodeRunOutput out = run("string-format", "string-format", DOWNSTREAM_INPUTS);
        assertTrue(out.isSuccess());
        assertEquals("Hello, World!", out.getOutputs().get("formatStringResult"));
    }

    @Test
    @DisplayName("variable: 常量赋值")
    void executeVariableNode() {
        SingleNodeRunOutput out = run("variable", "variable", null);
        assertTrue(out.isSuccess());
        assertEquals("Hello World", out.getOutputs().get("greeting"));
        assertEquals(42, ((Number) out.getOutputs().get("count")).intValue());
    }

    @Test
    @DisplayName("condition: 命中 if_match 分支")
    void executeConditionNodeMatch() {
        SingleNodeRunOutput out = run("condition", "condition", CONDITION_MATCH_INPUTS);
        assertTrue(out.isSuccess());
        assertEquals(Boolean.TRUE, out.getExecuteResult().get("if_match"));
    }

    @Test
    @DisplayName("condition: 未命中走 else 分支")
    void executeConditionNodeElse() {
        SingleNodeRunOutput out = run("condition", "condition", DOWNSTREAM_INPUTS);
        assertTrue(out.isSuccess());
        assertEquals(Boolean.FALSE, out.getExecuteResult().get("if_match"));
        assertEquals(Boolean.TRUE, out.getExecuteResult().get("else"));
    }

    @Test
    @DisplayName("http: 不可达服务时优雅降级（不抛异常，捕获 error）")
    void executeHttpNodeGracefulFailure() {
        SingleNodeRunOutput out = run("http", "http", null);
        // HttpNode 内部 catch 异常并写入 error，不会让 executor 失败
        assertTrue(out.isSuccess(), "http 节点应内部捕获异常而非抛出");
        assertNotNull(out.getExecuteResult());
    }

    @Test
    @DisplayName("llm: 不可达服务时优雅降级（捕获 error）")
    void executeLlmNodeGracefulFailure() {
        SingleNodeRunOutput out = run("llm", "llm", DOWNSTREAM_INPUTS);
        assertTrue(out.isSuccess(), "llm 节点应内部捕获异常而非抛出");
        // 不可达时 result 含 error
        assertNotNull(out.getExecuteResult().get("error"));
    }

    @Test
    @DisplayName("SingleNodeExecutor.isSupported: 控制流节点不支持单测")
    void unsupportedControlFlowTypes() {
        assertFalse(executor.isSupported("loop"));
        assertFalse(executor.isSupported("branches"));
        assertFalse(executor.isSupported("break"));
        assertFalse(executor.isSupported("continue"));
        assertFalse(executor.isSupported("workflow"));
    }

    @Test
    @DisplayName("SingleNodeExecutor.isSupported: 可执行节点支持单测")
    void supportedExecutableTypes() {
        assertTrue(executor.isSupported("start"));
        assertTrue(executor.isSupported("end"));
        assertTrue(executor.isSupported("code"));
        assertTrue(executor.isSupported("string-format"));
        assertTrue(executor.isSupported("variable"));
        assertTrue(executor.isSupported("condition"));
        assertTrue(executor.isSupported("http"));
        assertTrue(executor.isSupported("llm"));
    }

    // ==================== 辅助方法 ====================

    private SingleNodeRunOutput run(String nodeType, String fixtureName, Map<String, Object> inputs) {
        SingleNodeRunInput input = new SingleNodeRunInput();
        input.setNode(loadNodeJson(fixtureName).toString());
        input.setInputs(inputs);
        return executor.execute(input);
    }

    private static Map<String, Object> map(String k, Object v) {
        Map<String, Object> m = new HashMap<>();
        m.put(k, v);
        return m;
    }
}
