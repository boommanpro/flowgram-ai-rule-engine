package cn.boommanpro.gaia.workflow.infra.extend.node.loop;

import cn.boommanpro.gaia.workflow.base.GaiaWorkflow;
import cn.boommanpro.gaia.workflow.base.model.ChainEdge;
import cn.boommanpro.gaia.workflow.base.model.ChainNode;
import cn.boommanpro.gaia.workflow.base.node.ChainParser;
import cn.boommanpro.gaia.workflow.base.node.NodeParser;
import cn.boommanpro.gaia.workflow.infra.extend.node.BaseNodeParser;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 循环节点解析器，用于解析loop类型的节点
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 * @date 2025/05/17
 */
public class LoopNodeParser extends BaseNodeParser<LoopNode> {

    private static final String LOOP_FOR_PATH = "$.data.loopFor";
    private static final String LOOP_OUTPUTS_PATH = "$.data.loopOutputs";
    private static final String OUTPUTS_PATH = "$.data.outputs";
    private static final String MAX_LOOP_COUNT_PATH = "$.data.maxLoopCount";
    private static final String BLOCKS_PATH = "$.blocks";
    private static final String EDGES_PATH = "$.edges";

    @Override
    public LoopNode buildInstance(JSONObject nodeJSONObject, GaiaWorkflow workflow) {
        LoopNode loopNode = new LoopNode();

        // 解析循环遍历定义
        JSONObject loopForJson = (JSONObject) nodeJSONObject.getByPath(LOOP_FOR_PATH);
        if (loopForJson != null) {
            LoopNode.LoopFor loopFor = parseLoopFor(loopForJson);
            loopNode.setLoopFor(loopFor);
        }

        // 解析循环输出映射
        JSONObject loopOutputsJson = (JSONObject) nodeJSONObject.getByPath(LOOP_OUTPUTS_PATH);
        if (loopOutputsJson != null) {
            Map<String, LoopNode.LoopOutput> loopOutputs = new HashMap<>();
            for (String key : loopOutputsJson.keySet()) {
                JSONObject outputJson = loopOutputsJson.getJSONObject(key);
                LoopNode.LoopOutput loopOutput = parseLoopOutput(outputJson);
                loopOutputs.put(key, loopOutput);
            }
            loopNode.setLoopOutputs(loopOutputs);
        }

        // 解析迭代上限（0 表示不限制）
        Object maxLoopCountValue = nodeJSONObject.getByPath(MAX_LOOP_COUNT_PATH);
        if (maxLoopCountValue != null) {
            loopNode.setMaxLoopCount(Integer.parseInt(maxLoopCountValue.toString()));
        }

        // 解析输出定义
        JSONObject outputsJson = (JSONObject) nodeJSONObject.getByPath(OUTPUTS_PATH);
        if (outputsJson != null) {
            LoopNode.OutputDefinition outputs = parseOutputDefinition(outputsJson);
            loopNode.setOutputs(outputs);
        }

        // 解析子块并转换为nodes
        JSONArray blocksJsonArray = (JSONArray) nodeJSONObject.getByPath(BLOCKS_PATH);
        if (blocksJsonArray != null) {
            for (int i = 0; i < blocksJsonArray.size(); i++) {
                JSONObject blockJson = blocksJsonArray.getJSONObject(i);
                String blockType = blockJson.getStr("type");

                // 根据block类型创建对应的节点
                ChainNode blockNode = createNodeFromBlock(blockJson, blockType);
                if (blockNode != null) {
                    loopNode.addNode(blockNode);
                }
            }
        }

        // 解析边
        JSONArray edgesJsonArray = (JSONArray) nodeJSONObject.getByPath(EDGES_PATH);
        if (edgesJsonArray != null) {
            List<ChainEdge> edges = new ArrayList<>();
            for (int i = 0; i < edgesJsonArray.size(); i++) {
                JSONObject edgeJson = edgesJsonArray.getJSONObject(i);
                ChainEdge edge = ChainParser.parseEdge(edgeJson);
                edges.add(edge);
            }
            for (ChainEdge edge : edges) {
                loopNode.addEdge(edge);
            }
        }

        return loopNode;
    }

    /**
     * 解析循环遍历定义
     */
    private LoopNode.LoopFor parseLoopFor(JSONObject loopForJson) {
        LoopNode.LoopFor loopFor = new LoopNode.LoopFor();
        loopFor.setType(loopForJson.getStr("type"));

        // 根据类型设置内容
        if ("ref".equals(loopFor.getType())) {
            // 引用类型，content是字符串列表
            JSONArray contentArray = loopForJson.getJSONArray("content");
            if (contentArray != null) {
                List<String> content = new ArrayList<>();
                for (int i = 0; i < contentArray.size(); i++) {
                    content.add(contentArray.getStr(i));
                }
                loopFor.setContent(content);
            }
        } else if ("constant".equals(loopFor.getType())) {
            // 常量类型，content是具体的常量值
            loopFor.setContent(loopForJson.get("content"));
        }

        return loopFor;
    }

    /**
     * 解析循环输出定义
     */
    private LoopNode.LoopOutput parseLoopOutput(JSONObject outputJson) {
        LoopNode.LoopOutput loopOutput = new LoopNode.LoopOutput();
        loopOutput.setType(outputJson.getStr("type"));

        // 根据类型设置内容
        if ("ref".equals(loopOutput.getType())) {
            // 引用类型，content是字符串列表
            JSONArray contentArray = outputJson.getJSONArray("content");
            if (contentArray != null) {
                List<String> content = new ArrayList<>();
                for (int i = 0; i < contentArray.size(); i++) {
                    content.add(contentArray.getStr(i));
                }
                loopOutput.setContent(content);
            }
        } else if ("constant".equals(loopOutput.getType())) {
            // 常量类型，content是具体的常量值
            loopOutput.setContent(outputJson.get("content"));
        }

        return loopOutput;
    }

    /**
     * 解析输出定义
     */
    private LoopNode.OutputDefinition parseOutputDefinition(JSONObject outputsJson) {
        LoopNode.OutputDefinition outputs = new LoopNode.OutputDefinition();
        outputs.setType(outputsJson.getStr("type"));

        // 解析required字段
        JSONArray requiredArray = outputsJson.getJSONArray("required");
        if (requiredArray != null) {
            List<String> required = new ArrayList<>();
            for (int i = 0; i < requiredArray.size(); i++) {
                required.add(requiredArray.getStr(i));
            }
            outputs.setRequired(required);
        }

        // 解析properties字段
        JSONObject propertiesJson = outputsJson.getJSONObject("properties");
        if (propertiesJson != null) {
            Map<String, LoopNode.PropertyDefinition> properties = new HashMap<>();
            for (String key : propertiesJson.keySet()) {
                JSONObject propertyJson = propertiesJson.getJSONObject(key);
                LoopNode.PropertyDefinition property = parsePropertyDefinition(propertyJson);
                properties.put(key, property);
            }
            outputs.setProperties(properties);
        }

        return outputs;
    }

    /**
     * 解析属性定义
     */
    private LoopNode.PropertyDefinition parsePropertyDefinition(JSONObject propertyJson) {
        LoopNode.PropertyDefinition property = new LoopNode.PropertyDefinition();
        property.setType(propertyJson.getStr("type"));
        property.setDescription(propertyJson.getStr("description"));

        // 解析items字段（用于数组类型）
        JSONObject itemsJson = propertyJson.getJSONObject("items");
        if (itemsJson != null) {
            LoopNode.PropertyDefinition items = parsePropertyDefinition(itemsJson);
            property.setItems(items);
        }

        return property;
    }



    /**
     * 根据block类型创建对应的节点
     */
    private ChainNode createNodeFromBlock(JSONObject blockJson, String blockType) {
        try {
            // 获取全局的节点解析器映射
            ChainParser chainParser = new ChainParser();
            Map<String, NodeParser> nodeParserMap = chainParser.getNodeParserMap();

            NodeParser nodeParser = nodeParserMap.get(blockType);
            if (nodeParser != null) {
                return nodeParser.parse(blockJson, null);
            }

            // 如果找不到对应的解析器，返回null
            // BaseNode是抽象类，无法直接实例化
            return null;

        } catch (Exception e) {
            // 解析失败时返回null
            return null;
        }
    }
}

