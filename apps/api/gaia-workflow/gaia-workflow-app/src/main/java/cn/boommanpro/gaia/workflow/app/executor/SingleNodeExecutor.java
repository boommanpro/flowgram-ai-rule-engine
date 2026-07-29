package cn.boommanpro.gaia.workflow.app.executor;

import cn.boommanpro.gaia.workflow.app.domain.testrun.input.SingleNodeRunInput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.SingleNodeRunOutput;
import cn.boommanpro.gaia.workflow.base.GaiaWorkflow;
import cn.boommanpro.gaia.workflow.base.model.Chain;
import cn.boommanpro.gaia.workflow.base.model.ChainNode;
import cn.boommanpro.gaia.workflow.base.model.Parameter;
import cn.boommanpro.gaia.workflow.base.node.ChainParser;
import cn.boommanpro.gaia.workflow.base.node.NodeParser;
import cn.boommanpro.gaia.workflow.base.type.RefType;
import cn.hutool.core.exceptions.ExceptionUtil;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 单节点执行器
 * <p>
 * 解析并独立执行工作流中的单个节点，用于编辑器中的节点级测试。
 * 用户可提供模拟的内存上下文（inputs）以解析 ref/template 引用。
 * <p>
 * 支持测试的节点类型：start, end, code, string-format, variable, http, llm, condition。
 * 不支持：loop, block-start, block-end, continue, break, branches, workflow（控制流/嵌套结构），
 * 以及 group, note, comment, assignee（非执行节点）。
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 */
@Slf4j
@Component
public class SingleNodeExecutor {

    /**
     * 不支持单节点测试的节点类型（控制流、嵌套结构等）
     */
    private static final Set<String> UNSUPPORTED_TYPES = new HashSet<>(Arrays.asList(
            "loop", "block-start", "block-end", "continue", "break", "branches", "workflow",
            "group", "note", "comment", "assignee", "multi-condition"
    ));

    /**
     * 执行单个节点
     *
     * @param input 节点 JSON 与模拟内存上下文
     * @return 执行结果
     */
    public SingleNodeRunOutput execute(SingleNodeRunInput input) {
        long startTime = System.currentTimeMillis();

        // 解析节点 JSON
        JSONObject nodeJSONObject = JSONUtil.parseObj(input.getNode());
        String nodeType = nodeJSONObject.getStr("type");

        if (nodeType == null || nodeType.isEmpty()) {
            return SingleNodeRunOutput.fail(null, "节点缺少 type 字段", 0);
        }

        if (UNSUPPORTED_TYPES.contains(nodeType)) {
            return SingleNodeRunOutput.fail(nodeType,
                    "该节点类型（" + nodeType + "）不支持单独测试，请通过完整工作流试运行进行测试", 0);
        }

        NodeParser nodeParser = new ChainParser().getNodeParserMap().get(nodeType);
        if (nodeParser == null) {
            return SingleNodeRunOutput.fail(nodeType,
                    "未找到节点类型 " + nodeType + " 的解析器", 0);
        }

        try {
            // 构造一个仅包含当前节点的工作流 schema，用于 GaiaWorkflow 实例化
            JSONArray nodesArray = new JSONArray();
            nodesArray.set(nodeJSONObject);
            JSONArray edgesArray = new JSONArray();
            String schema = JSONUtil.createObj()
                    .set("nodes", nodesArray)
                    .set("edges", edgesArray)
                    .toString();
            GaiaWorkflow workflow = new GaiaWorkflow(schema);

            // 直接调用 NodeParser 解析单个节点（绕过 ChainParser.parse 的 validateChain 校验）
            ChainNode chainNode = nodeParser.parse(nodeJSONObject, workflow);
            if (chainNode == null) {
                return SingleNodeRunOutput.fail(nodeType, "节点解析返回 null", 0);
            }

            // 构造最小 Chain 并注入内存上下文
            Chain chain = new Chain();
            if (input.getInputs() != null) {
                chain.getMemory().putAll(input.getInputs());
            }

            // 执行节点
            Map<String, Object> executeResult = chainNode.execute(chain);

            // 解析输出
            List<Parameter> outputParameters = chainNode.getOutputParameters();
            Map<String, Object> outputs = parseOutputResult(outputParameters, executeResult);

            long timeCost = System.currentTimeMillis() - startTime;
            log.info("单节点执行成功: type={}, id={}, cost={}ms", nodeType, chainNode.getId(), timeCost);

            return SingleNodeRunOutput.success(nodeType, outputs, executeResult, timeCost);

        } catch (Throwable e) {
            long timeCost = System.currentTimeMillis() - startTime;
            log.error("单节点执行失败: type={}", nodeType, e);
            String errorMsg = e.getMessage() != null ? e.getMessage() : ExceptionUtil.stacktraceToString(e);
            return SingleNodeRunOutput.fail(nodeType, errorMsg, timeCost);
        }
    }

    /**
     * 解析节点输出参数
     * <p>
     * 复制 Chain.parseOutputResult 的逻辑（该方法在 Chain 中为 private），
     * 根据 outputParameters 声明从 executeResult 中提取对应的值。
     */
    private Map<String, Object> parseOutputResult(List<Parameter> outputParameters, Map<String, Object> execute) {
        if (outputParameters == null) {
            return execute != null ? execute : new HashMap<>();
        }

        Map<String, Object> result = new HashMap<>();
        List<String> missingParams = new ArrayList<>();

        for (Parameter parameter : outputParameters) {
            Object value = null;
            if (parameter.getRefType() == RefType.REF) {
                List<String> refValue = parameter.getRefValue();
                if (refValue != null && refValue.size() >= 2) {
                    Object nodeResult = execute.get(refValue.get(0));
                    if (nodeResult instanceof Map) {
                        Map<String, Object> nodeResultMap = (Map<String, Object>) nodeResult;
                        value = nodeResultMap.get(refValue.get(1));
                    }
                } else if (refValue != null && !refValue.isEmpty()) {
                    value = execute.getOrDefault(String.join(".", refValue), parameter.getDefaultValue());
                }
            } else {
                value = parameter.getDefaultValue();
            }

            if (parameter.isRequire() && value == null) {
                missingParams.add(parameter.getName());
            }
            result.put(parameter.getName(), value);
        }

        if (!missingParams.isEmpty()) {
            throw new RuntimeException("必填输出参数缺失: " + String.join(", ", missingParams));
        }

        return result;
    }

    /**
     * 判断节点类型是否支持单节点测试
     *
     * @param nodeType 节点类型
     * @return 是否支持
     */
    public boolean isSupported(String nodeType) {
        return nodeType != null && !UNSUPPORTED_TYPES.contains(nodeType)
                && new ChainParser().getNodeParserMap().containsKey(nodeType);
    }
}
