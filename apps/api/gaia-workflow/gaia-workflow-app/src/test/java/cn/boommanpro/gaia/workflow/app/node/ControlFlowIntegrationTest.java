package cn.boommanpro.gaia.workflow.app.node;

import cn.boommanpro.gaia.workflow.base.GaiaWorkflow;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 维度四：控制流与全链路工作流集成测试。
 * <p>
 * 通过 {@link GaiaWorkflow#run(java.util.Map)} 执行完整工作流 JSON，
 * 验证节点编排、ref 引用解析、条件分支等控制流语义。
 * 这层测试替代 Chrome 集成测试，覆盖 start→...→end 的端到端正确性。
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 */
@DisplayName("控制流与工作流集成测试")
class ControlFlowIntegrationTest extends AbstractNodeTest {

    @Test
    @DisplayName("线性流水线：start → string-format → end")
    void stringFormatPipeline() {
        GaiaWorkflow wf = new GaiaWorkflow(loadWorkflowJson("string-format-pipeline"));
        Map<String, Object> result = wf.run(map("query", "World"));
        assertNotNull(result);
        assertEquals("Hello, World!", result.get("output"));
    }

    @Test
    @DisplayName("JS 代码节点流水线：start → code(js) → end")
    void codeJsPipeline() {
        GaiaWorkflow wf = new GaiaWorkflow(loadWorkflowJson("code-js-pipeline"));
        Map<String, Object> result = wf.run(map("query", "World"));
        assertNotNull(result);
        assertEquals("Hello, World!", result.get("output"));
    }

    @Test
    @DisplayName("条件分支：默认值命中 if_match 分支")
    void conditionBranchMatch() {
        GaiaWorkflow wf = new GaiaWorkflow(loadWorkflowJson("condition-branch"));
        Map<String, Object> result = wf.run(new HashMap<>());
        assertNotNull(result, "工作流应正常执行并返回结果");
        // 默认 query="Hello Flow." 命中 if_match → end_match.output="matched"
        assertEquals("matched", result.get("output"));
    }

    @Test
    @DisplayName("条件分支：传入非匹配值走 else 分支")
    void conditionBranchElse() {
        GaiaWorkflow wf = new GaiaWorkflow(loadWorkflowJson("condition-branch"));
        Map<String, Object> result = wf.run(map("query", "other value"));
        assertNotNull(result, "工作流应正常执行并返回结果");
        assertEquals("else", result.get("output"));
    }

    @Test
    @DisplayName("空工作流输入不抛异常")
    void emptyInputsRun() {
        GaiaWorkflow wf = new GaiaWorkflow(loadWorkflowJson("string-format-pipeline"));
        // 不传 inputs，start 使用 schema 默认值
        Map<String, Object> result = wf.run(new HashMap<>());
        assertNotNull(result);
    }

    private static Map<String, Object> map(String k, Object v) {
        Map<String, Object> m = new HashMap<>();
        m.put(k, v);
        return m;
    }
}
