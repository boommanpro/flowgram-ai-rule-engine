package cn.boommanpro.gaia.workflow.app.node;

import cn.boommanpro.gaia.workflow.base.model.ChainNode;
import cn.boommanpro.gaia.workflow.base.type.NodeTypeEnum;
import cn.boommanpro.gaia.workflow.infra.extend.node.code.CodeNode;
import cn.boommanpro.gaia.workflow.infra.extend.node.code.DynamicCompileNode;
import cn.boommanpro.gaia.workflow.infra.extend.node.code.JsFunExecNode;
import cn.boommanpro.gaia.workflow.infra.extend.node.condition.ConditionNode;
import cn.boommanpro.gaia.workflow.infra.extend.node.branch.BranchesNode;
import cn.boommanpro.gaia.workflow.infra.extend.node.http.HttpNode;
import cn.boommanpro.gaia.workflow.infra.extend.node.llm.LlmNode;
import cn.boommanpro.gaia.workflow.infra.extend.node.loop.LoopNode;
import cn.boommanpro.gaia.workflow.infra.extend.node.stringformat.StringFormatCode;
import cn.boommanpro.gaia.workflow.infra.extend.node.variable.VariableNode;
import cn.boommanpro.gaia.workflow.infra.extend.node.workflow.WorkflowNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 节点解析器层单测 —— 覆盖 {@link NodeTypeEnum} 中全部用户可见节点类型。
 * <p>
 * 维度一：JSON → ChainNode 的解析正确性（id/type/类型特有字段）。
 * 非执行节点（group/note/comment/assignee）校验其被 ChainParser 正确跳过。
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 */
@DisplayName("节点解析器单测（17+ 类节点）")
class NodeParserTest extends AbstractNodeTest {

    // ==================== 可执行节点 ====================

    @Test
    @DisplayName("start: 解析输出参数 query")
    void parseStartNode() {
        ChainNode node = parse("start", "start");
        assertEquals("start_0", node.getId());
        assertEquals(NodeTypeEnum.START, node.getNodeType());
        assertFalse(node.getOutputParameters().isEmpty(), "start 应有输出参数");
        assertEquals("query", node.getOutputParameters().get(0).getName());
    }

    @Test
    @DisplayName("end: 解析输入参数 ref 引用")
    void parseEndNode() {
        ChainNode node = parse("end", "end");
        assertEquals("end_0", node.getId());
        assertEquals(NodeTypeEnum.END, node.getNodeType());
        assertFalse(node.getOutputParameters().isEmpty(), "end 应有输入参数映射");
        assertEquals("output", node.getOutputParameters().get(0).getName());
    }

    @Test
    @DisplayName("code(java): 路由到 DynamicCompileNode，语言=java")
    void parseCodeNodeJava() {
        ChainNode node = parse("code", "code-java");
        assertEquals("code_java_0", node.getId());
        assertEquals(NodeTypeEnum.CODE, node.getNodeType());
        assertInstanceOf(DynamicCompileNode.class, node, "java 语言应路由到 DynamicCompileNode");
        assertFalse(node.getParameters().isEmpty(), "code 应有输入参数");
        assertEquals("name", node.getParameters().get(0).getName());
    }

    @Test
    @DisplayName("code(groovy): 路由到 DynamicCompileNode")
    void parseCodeNodeGroovy() {
        ChainNode node = parse("code", "code-groovy");
        assertInstanceOf(DynamicCompileNode.class, node);
        assertEquals(NodeTypeEnum.CODE, node.getNodeType());
    }

    @Test
    @DisplayName("code(javascript): 路由到 JsFunExecNode（修复点：javascript 不再落到 DynamicCompileNode）")
    void parseCodeNodeJavaScript() {
        ChainNode node = parse("code", "code-js");
        assertEquals("code_js_0", node.getId());
        assertInstanceOf(JsFunExecNode.class, node, "javascript 语言应路由到 JsFunExecNode");
    }

    @Test
    @DisplayName("string-format: 解析模板与语言")
    void parseStringFormatNode() {
        ChainNode node = parse("string-format", "string-format");
        assertEquals("string_format_0", node.getId());
        assertInstanceOf(StringFormatCode.class, node);
        StringFormatCode sfc = (StringFormatCode) node;
        assertEquals("Hello, ${name}!", sfc.getFormatString());
        assertEquals("spel-standard", sfc.getLanguage());
    }

    @Test
    @DisplayName("variable: 解析 assign 列表")
    void parseVariableNode() {
        ChainNode node = parse("variable", "variable");
        assertEquals("variable_0", node.getId());
        assertInstanceOf(VariableNode.class, node);
        VariableNode vn = (VariableNode) node;
        assertEquals(2, vn.getAssigns().size(), "应有 2 个赋值项");
        assertEquals("greeting", vn.getAssigns().get(0).getLeft());
    }

    @Test
    @DisplayName("condition: 解析条件列表与操作符")
    void parseConditionNode() {
        ChainNode node = parse("condition", "condition");
        assertEquals("condition_0", node.getId());
        assertInstanceOf(ConditionNode.class, node);
        ConditionNode cn = (ConditionNode) node;
        assertEquals(2, cn.getConditions().size());
        assertEquals("if_match", cn.getConditions().get(0).getKey());
        assertEquals("eq", cn.getConditions().get(0).getValue().getOperator());
    }

    @Test
    @DisplayName("http: 解析 api/headers/params/body")
    void parseHttpNode() {
        ChainNode node = parse("http", "http");
        assertEquals("http_0", node.getId());
        assertInstanceOf(HttpNode.class, node);
        HttpNode hn = (HttpNode) node;
        assertEquals("GET", hn.getApi().getMethod());
        assertFalse(hn.getHeadersValues().isEmpty(), "应有请求头");
        assertNotNull(hn.getTimeout(), "应有超时配置");
    }

    @Test
    @DisplayName("llm: 解析模型/prompt 输入")
    void parseLlmNode() {
        ChainNode node = parse("llm", "llm");
        assertEquals("llm_0", node.getId());
        assertInstanceOf(LlmNode.class, node);
        LlmNode ln = (LlmNode) node;
        assertFalse(ln.getInputsValues().isEmpty(), "应有输入值");
        assertNotNull(ln.getTimeout(), "应有超时配置");
    }

    // ==================== 控制流节点 ====================

    @Test
    @DisplayName("branches: 解析多路分支")
    void parseBranchesNode() {
        ChainNode node = parse("branches", "branches");
        assertEquals("branches_0", node.getId());
        assertInstanceOf(BranchesNode.class, node);
        BranchesNode bn = (BranchesNode) node;
        assertEquals(2, bn.getBranches().size());
        assertEquals("branch_match", bn.getBranches().get(0).getId());
    }

    @Test
    @DisplayName("loop: 解析 loopFor/loopOutputs/blocks/edges")
    void parseLoopNode() {
        ChainNode node = parse("loop", "loop");
        assertEquals("loop_0", node.getId());
        assertInstanceOf(LoopNode.class, node);
        LoopNode ln = (LoopNode) node;
        assertNotNull(ln.getLoopFor(), "应有 loopFor");
        assertNotNull(ln.getLoopOutputs(), "应有 loopOutputs");
        assertFalse(ln.getNodes() == null || ln.getNodes().isEmpty(), "应解析出子块节点");
    }

    @Test
    @DisplayName("block-start: 解析为 BlockStartNode")
    void parseBlockStartNode() {
        ChainNode node = parse("block-start", "block-start");
        assertEquals("block_start_0", node.getId());
        assertEquals(NodeTypeEnum.BLOCK_START, node.getNodeType());
    }

    @Test
    @DisplayName("block-end: 解析为 BlockEndNode")
    void parseBlockEndNode() {
        ChainNode node = parse("block-end", "block-end");
        assertEquals("block_end_0", node.getId());
        assertEquals(NodeTypeEnum.BLOCK_END, node.getNodeType());
    }

    @Test
    @DisplayName("break: 解析为 BreakNode")
    void parseBreakNode() {
        ChainNode node = parse("break", "break");
        assertEquals("break_0", node.getId());
        assertEquals(NodeTypeEnum.BREAK, node.getNodeType());
    }

    @Test
    @DisplayName("continue: 解析为 ContinueNode")
    void parseContinueNode() {
        ChainNode node = parse("continue", "continue");
        assertEquals("continue_0", node.getId());
        assertEquals(NodeTypeEnum.CONTINUE, node.getNodeType());
    }

    @Test
    @DisplayName("workflow: 解析子工作流引用")
    void parseWorkflowNode() {
        ChainNode node = parse("workflow", "workflow");
        assertEquals("workflow_0", node.getId());
        assertInstanceOf(WorkflowNode.class, node);
        WorkflowNode wn = (WorkflowNode) node;
        assertEquals("wf_sub_example", wn.getWorkflowId());
        assertNotNull(wn.getInputs(), "应有输入 schema");
    }

    // ==================== 非执行节点（被 ChainParser 跳过） ====================

    @Nested
    @DisplayName("非执行节点：notParse 校验")
    class NonParseNodes {

        @Test
        @DisplayName("group: notParse=true")
        void groupSkipped() {
            assertTrue(NodeTypeEnum.notParse("group"));
        }

        @Test
        @DisplayName("note: notParse=true")
        void noteSkipped() {
            assertTrue(NodeTypeEnum.notParse("note"));
        }

        @Test
        @DisplayName("comment: notParse=true")
        void commentSkipped() {
            assertTrue(NodeTypeEnum.notParse("comment"));
        }

        @Test
        @DisplayName("assignee: notParse=true")
        void assigneeSkipped() {
            assertTrue(NodeTypeEnum.notParse("assignee"));
        }

        @Test
        @DisplayName("空类型: notParse=true")
        void blankTypeSkipped() {
            assertTrue(NodeTypeEnum.notParse(""));
            assertTrue(NodeTypeEnum.notParse(null));
        }
    }
}
