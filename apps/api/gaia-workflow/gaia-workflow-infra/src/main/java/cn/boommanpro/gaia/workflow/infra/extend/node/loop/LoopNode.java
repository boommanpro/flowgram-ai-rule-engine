package cn.boommanpro.gaia.workflow.infra.extend.node.loop;

import cn.boommanpro.gaia.workflow.base.model.Chain;
import cn.boommanpro.gaia.workflow.base.model.ChainEdge;
import cn.boommanpro.gaia.workflow.base.model.ChainNode;
import cn.boommanpro.gaia.workflow.base.model.NodeContext;
import cn.boommanpro.gaia.workflow.base.type.DataType;
import cn.boommanpro.gaia.workflow.base.model.Parameter;
import cn.boommanpro.gaia.workflow.base.type.RefType;
import cn.boommanpro.gaia.workflow.base.type.ChainEdgeStatus;
import cn.boommanpro.gaia.workflow.base.type.ChainNodeStatus;
import cn.boommanpro.gaia.workflow.base.type.ChainStatus;
import cn.boommanpro.gaia.workflow.base.tools.SpringExpressionParser;
import cn.hutool.core.util.StrUtil;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONUtil;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.extern.slf4j.Slf4j;

import java.lang.reflect.Array;
import java.util.*;

/**
 * 循环节点，用于处理工作流中的循环逻辑
 * 参考agents-flex-core的设计，LoopNode作为特殊的Chain来处理循环逻辑
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 * @date 2025/05/17
 */
@Slf4j
@Data
@EqualsAndHashCode(callSuper = true)
public class LoopNode extends Chain {

    // 循环遍历的对象
    private LoopFor loopFor;

    // 循环输出映射
    private Map<String, LoopOutput> loopOutputs = new HashMap<>();

    // 输出定义
    private OutputDefinition outputs;

    // 子块列表
    private List<Block> blocks = new ArrayList<>();

    // 循环控制变量
    private int currentLoopIndex = 0;
    private Object currentLoopItem;
    private boolean loopBreak = false;
    private boolean loopContinue = false;

    @Override
    public Map<String, Object> execute(Chain parent) {
        // 重置循环状态
        resetLoopState();

        // 获取循环数据
        Object loopData = getLoopData(parent);
        if (loopData == null) {
            log.warn("Loop data is null, skipping loop execution");
            return new HashMap<>();
        }

        // 将循环数据转换为列表
        List<Object> loopList = convertToList(loopData);
        if (loopList.isEmpty()) {
            log.info("Loop list is empty, skipping loop execution");
            return new HashMap<>();
        }

        // 初始化输出结果
        Map<String, List<Object>> outputResults = new HashMap<>();
        for (String outputKey : loopOutputs.keySet()) {
            outputResults.put(outputKey, new ArrayList<>());
        }

        // 执行循环（受 maxLoopCount 约束，0 表示不限制）
        int maxCount = maxLoopCount > 0 ? Math.min(loopList.size(), maxLoopCount) : loopList.size();
        for (int i = 0; i < maxCount; i++) {
            currentLoopIndex = i;
            currentLoopItem = loopList.get(i);
            loopBreak = false;
            loopContinue = false;

            // 重置每次迭代的状态
            resetIterationState();

            // 设置循环变量到内存
            HashMap<String, Object> localContent = new HashMap<>();
            localContent.put("item", currentLoopItem);
            localContent.put("index", currentLoopIndex);
            localContent.put("control", null);
            parent.getMemory().put(this.getId()+"_locals", localContent);

            try {
                // 将 parent 的 memory 复制到当前 LoopNode 的 memory 中
                // 这样 executeInternal() 才能正确访问所有变量
                this.getMemory().putAll(parent.getMemory());

                // 执行子链逻辑
                // 通过 executeForResult 来正确管理执行生命周期
                Map<String, Object> iterationResult = this.executeForResult(this.getMemory(), false);

                // 将执行结果合并回 parent 的 memory
                if (iterationResult != null) {
                    this.getMemory().putAll(iterationResult);
                }

                // 检查是否遇到break
                if (loopBreak) {
                    log.info("Loop execution interrupted by break at index {}", i);
                    break;
                }

                // 检查是否遇到continue
                if (loopContinue) {
                    log.info("Loop execution continued at index {}", i);
                    continue;
                }

                // 收集输出
                collectOutputs(parent, outputResults);

            } catch (Exception e) {
                log.error("Error in loop iteration {}: {}", i, e.getMessage(), e);
                // 循环中的错误应该中断整个循环
                throw new RuntimeException(e);
            }
        }

        // 清理循环变量
        parent.getMemory().remove("loop.item");
        parent.getMemory().remove("loop.index");
        parent.getMemory().remove("loop.control");

        // 将结果转换为最终输出格式
        Map<String, Object> result = new HashMap<>();
        for (Map.Entry<String, List<Object>> entry : outputResults.entrySet()) {
            result.put(entry.getKey(), entry.getValue());
        }

        return result;
    }

    @Override
    protected void executeInternal() {
        // 直接调用父类的executeInternal方法，使用Chain的完整执行逻辑
        // 这样可以正确处理nodes和edges
        super.executeInternal();
    }


    @Override
    protected void onNodeExecuteAfter(NodeContext nodeContext) {
        // 检查是否有循环控制标记
        String controlFlag = (String) getMemory().get("loop.control");
        if ("break".equals(controlFlag)) {
            loopBreak = true;
        } else if ("continue".equals(controlFlag)) {
            loopContinue = true;
        }
    }

    /**
     * 重置循环状态
     */
    private void resetLoopState() {
        currentLoopIndex = 0;
        currentLoopItem = null;
        loopBreak = false;
        loopContinue = false;
    }

    /**
     * 重置 LoopNode 的执行状态（用于每次循环迭代）
     */
    private void resetIterationState() {
        // 重置 Chain 的执行状态
        this.setStatus(ChainStatus.READY);
        this.setException(null);
        this.setMessage(null);
        this.setExecuteResult(null);

        // 重置所有节点的状态
        if (this.getNodes() != null) {
            for (ChainNode node : this.getNodes()) {
                node.setStatus(ChainNodeStatus.READY);
            }
        }
        if (this.getEdges()!=null) {
            for (ChainEdge edge : this.getEdges()) {
                edge.setStatus(ChainEdgeStatus.READY);
            }
        }

        // 清空节点上下文
        this.getNodeContexts().clear();
        this.getMemory().clear();
        this.getMemory().putAll(this.getParent().getMemory());
        this.clearExecuteInfoMap();
    }

    /**
     * 获取循环数据
     */
    private Object getLoopData(Chain parent) {
        if (loopFor == null) {
            return null;
        }

        if ("ref".equals(loopFor.getType())) {
            Object content = loopFor.getContent();
            if (content instanceof List) {
                List<String> contentList = (List<String>) content;
                String key = String.join(".", contentList);
                return SpringExpressionParser.getInstance().getValue(key, parent.getMemory());
            }
        } else if ("constant".equals(loopFor.getType())) {
            return loopFor.getContent();
        }

        return null;
    }

    /**
     * 将数据转换为列表
     */
    @SuppressWarnings("unchecked")
    private List<Object> convertToList(Object data) {
        if (data == null) {
            return new ArrayList<>();
        }

        if (data instanceof List) {
            return (List<Object>) data;
        }

        if (data instanceof JSONArray) {
            return ((JSONArray) data).toList(Object.class);
        }

        // 如果是数组，转换为列表
        if (data.getClass().isArray()) {
            // 基本类型数组（int[]/long[]/char[] 等）强转 Object[] 会抛 ClassCastException，
            // 这里统一通过反射逐元素读取，兼容对象数组与基本类型数组。
            if (data instanceof Object[]) {
                return Arrays.asList((Object[]) data);
            }
            int length = Array.getLength(data);
            List<Object> arrayList = new ArrayList<>(length);
            for (int i = 0; i < length; i++) {
                arrayList.add(Array.get(data, i));
            }
            return arrayList;
        }

        // 如果是字符串且看起来像JSON数组
        if (data instanceof String) {
            String dataStr = (String) data;
            if (dataStr.startsWith("[") && dataStr.endsWith("]")) {
                try {
                    JSONArray array = JSONUtil.parseArray(dataStr);
                    return array.toList(Object.class);
                } catch (Exception e) {
                    log.warn("Failed to parse array string: {}", dataStr, e);
                }
            }
        }

        // 单个元素转换为单元素列表
        return Collections.singletonList(data);
    }

    /**
     * 收集输出结果
     */
    private void collectOutputs(Chain parent, Map<String, List<Object>> outputResults) {
        for (Map.Entry<String, LoopOutput> entry : loopOutputs.entrySet()) {
            String outputKey = entry.getKey();
            LoopOutput loopOutput = entry.getValue();

            Object outputValue = getOutputValue(loopOutput, parent);
            if (outputValue != null) {
                outputResults.get(outputKey).add(outputValue);
            }
        }
    }

    /**
     * 获取输出值
     */
    private Object getOutputValue(LoopOutput loopOutput, Chain parent) {
        Map<String, Object> context = new HashMap<>();
        context.putAll(parent.getMemory());
        context.putAll(this.getMemory());
        if ("ref".equals(loopOutput.getType())) {
            Object content = loopOutput.getContent();
            if (content instanceof List) {
                List<String> contentList = (List<String>) content;
                String key = String.join(".", contentList);

                // 特殊处理loop.item和loop.index
                if ("loop.item".equals(key)) {
                    return currentLoopItem;
                } else if ("loop.index".equals(key)) {
                    return currentLoopIndex;
                } else {
                    return SpringExpressionParser.getInstance().getValue(key, context);
                }
            }
        } else if ("constant".equals(loopOutput.getType())) {
            return loopOutput.getContent();
        }

        return null;
    }

    @Override
    public List<Parameter> getOutputParameters() {
        List<Parameter> parameters = new ArrayList<>();

        if (outputs != null && outputs.getProperties() != null) {
            for (Map.Entry<String, PropertyDefinition> entry : outputs.getProperties().entrySet()) {
                String key = entry.getKey();
                PropertyDefinition property = entry.getValue();

                Parameter parameter = new Parameter();
                parameter.setName(key);
                parameter.setType(convertDataType(property.getType()));
                parameter.setDescription(property.getDescription());
                parameter.setRefType(RefType.REF);
                parameter.setRefValue(Collections.singletonList(key));
                parameters.add(parameter);
            }
        }

        return parameters;
    }

    /**
     * 转换数据类型
     */
    private DataType convertDataType(String type) {
        if (StrUtil.isBlank(type)) {
            return DataType.String;
        }

        switch (type.toLowerCase()) {
            case "string":
                return DataType.String;
            case "number":
            case "integer":
                return DataType.Number;
            case "boolean":
                return DataType.Boolean;
            case "array":
                return DataType.Array_Object;
            case "object":
                return DataType.Object;
            default:
                return DataType.String;
        }
    }

    /**
     * 循环遍历定义
     */
    @Data
    public static class LoopFor {
        private String type; // "ref" or "constant"
        private Object content;
    }

    /**
     * 循环输出定义
     */
    @Data
    public static class LoopOutput {
        private String type; // "ref" or "constant"
        private Object content;
    }

    /**
     * 输出定义
     */
    @Data
    public static class OutputDefinition {
        private String type;
        private List<String> required;
        private Map<String, PropertyDefinition> properties;
    }

    /**
     * 属性定义
     */
    @Data
    public static class PropertyDefinition {
        private String type;
        private String description;
        private PropertyDefinition items; // 用于数组类型
    }

    /**
     * 块定义
     */
    @Data
    public static class Block {
        private String id;
        private String type;
        private Map<String, Object> meta;
        private Map<String, Object> data;
    }

    @Override
    protected Map<String, Object> getParametersData(Chain chain) {
        return chain.getMemory();
    }

}

