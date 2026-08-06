package cn.boommanpro.gaia.workflow.infra.extend.node.llm;

import cn.boommanpro.gaia.workflow.base.model.Chain;
import cn.boommanpro.gaia.workflow.base.type.NodeTypeEnum;
import cn.boommanpro.gaia.workflow.base.type.DataType;
import cn.boommanpro.gaia.workflow.base.model.Parameter;
import cn.boommanpro.gaia.workflow.base.type.RefType;
import cn.boommanpro.gaia.workflow.base.tools.SpringExpressionParser;
import cn.boommanpro.gaia.workflow.infra.extend.node.BaseNode;
import cn.hutool.core.util.StrUtil;
import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * LLM节点，用于调用大语言模型API
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 */
@Slf4j
@Data
@EqualsAndHashCode(callSuper = true)
public class LlmNode extends BaseNode {

    // 输入参数值
    private Map<String, Object> inputsValues = new HashMap<>();

    // 超时配置
    private TimeoutConfig timeout;

    @Override
    public Map<String, Object> execute(Chain chain) {

        Map<String, Object> result = new HashMap<>();

        try {
            // 解析输入参数
            LlmRequest request = buildLlmRequest(chain);

            // 调用LLM API
            String response = callLlmApi(request);

            // 解析响应
            String llmResult = parseLlmResponse(response);

            // 构建结果
            result.put("result", llmResult);

        } catch (Exception e) {
            log.error("LLM调用执行失败", e);
            result.put("error", e.getMessage());
        }

        return result;
    }

    /**
     * 构建LLM请求
     * @param chain 工作流链
     * @return LLM请求对象
     */
    private LlmRequest buildLlmRequest(Chain chain) {
        LlmRequest request = new LlmRequest();

        // 解析模型名称
        Object modelNameObj = inputsValues.get("modelName");
        request.setModelName(parseValue(modelNameObj, chain));

        // 解析API密钥
        Object apiKeyObj = inputsValues.get("apiKey");
        request.setApiKey(parseValue(apiKeyObj, chain));

        // 解析API主机
        Object apiHostObj = inputsValues.get("apiHost");
        request.setApiHost(parseValue(apiHostObj, chain));

        // 解析温度参数
        Object temperatureObj = inputsValues.get("temperature");
        String temperatureStr = parseValue(temperatureObj, chain);
        if (StrUtil.isNotBlank(temperatureStr)) {
            try {
                request.setTemperature(Double.parseDouble(temperatureStr));
            } catch (NumberFormatException e) {
                log.warn("温度参数解析失败，使用默认值0.5", e);
                request.setTemperature(0.5);
            }
        } else {
            request.setTemperature(0.5);
        }

        // 解析系统提示词
        Object systemPromptObj = inputsValues.get("systemPrompt");
        request.setSystemPrompt(parseTemplate(systemPromptObj, chain));

        // 解析用户提示词
        Object promptObj = inputsValues.get("prompt");
        request.setPrompt(parseTemplate(promptObj, chain));

        return request;
    }

    /**
     * 调用LLM API
     * @param request LLM请求对象
     * @return API响应字符串
     */
    private String callLlmApi(LlmRequest request) {
        String url = request.getApiHost();
        if (!url.endsWith("/")) {
            url += "/";
        }
        url += "chat/completions";

        // 构建请求体
        JSONObject requestBody = new JSONObject();
        requestBody.set("model", request.getModelName());
        requestBody.set("temperature", request.getTemperature());

        // 构建消息数组
        List<Map<String, String>> messages = new ArrayList<>();

        // 添加系统消息
        if (StrUtil.isNotBlank(request.getSystemPrompt())) {
            Map<String, String> systemMessage = new HashMap<>();
            systemMessage.put("role", "system");
            systemMessage.put("content", request.getSystemPrompt());
            messages.add(systemMessage);
        }

        // 添加用户消息
        if (StrUtil.isNotBlank(request.getPrompt())) {
            Map<String, String> userMessage = new HashMap<>();
            userMessage.put("role", "user");
            userMessage.put("content", request.getPrompt());
            messages.add(userMessage);
        }

        requestBody.set("messages", messages);

        // 发起HTTP请求
        HttpRequest httpRequest = new HttpRequest(url)
                .method(cn.hutool.http.Method.POST)
                .header("Authorization", "Bearer " + request.getApiKey())
                .header("Content-Type", "application/json")
                .body(requestBody.toString());

        // 设置超时
        if (timeout != null) {
            httpRequest.timeout(timeout.getTimeout());
        }

        HttpResponse response = httpRequest.execute();

        if (!response.isOk()) {
            throw new RuntimeException("LLM API调用失败，状态码: " + response.getStatus() + ", 响应: " + response.body());
        }

        return response.body();
    }

    /**
     * 解析LLM响应
     * @param response API响应字符串
     * @return 解析后的结果
     */
    private String parseLlmResponse(String response) {
        try {
            JSONObject jsonResponse = JSONUtil.parseObj(response);

            // 尝试从OpenAI格式的响应中提取内容
            if (jsonResponse.containsKey("choices")) {
                Object choices = jsonResponse.get("choices");
                if (choices instanceof List) {
                    List<?> choicesList = (List<?>) choices;
                    if (!choicesList.isEmpty()) {
                        Object firstChoice = choicesList.get(0);
                        if (firstChoice instanceof Map) {
                            Map<?, ?> choiceMap = (Map<?, ?>) firstChoice;
                            Object message = choiceMap.get("message");
                            if (message instanceof Map) {
                                Map<?, ?> messageMap = (Map<?, ?>) message;
                                Object content = messageMap.get("content");
                                return content != null ? content.toString() : "";
                            }
                        }
                    }
                }
            }

            // 如果无法解析，返回原始响应
            return response;

        } catch (Exception e) {
            log.warn("解析LLM响应失败，返回原始响应", e);
            return response;
        }
    }

    /**
     * 解析值（支持常量和引用）
     * @param valueObj 值对象
     * @param chain 工作流链
     * @return 解析后的字符串值
     */
    private String parseValue(Object valueObj, Chain chain) {
        if (valueObj instanceof Map) {
            Map<String, Object> valueMap = (Map<String, Object>) valueObj;
            String type = (String) valueMap.get("type");
            Object content = valueMap.get("content");

            if (RefType.CONSTANT.name().toLowerCase().equals(type)) {
                return content != null ? content.toString() : null;
            } else if (RefType.REF.name().toLowerCase().equals(type) && content instanceof List) {
                return resolveRef((List<?>) content, chain);
            }
        }
        return null;
    }

    /**
     * 解析模板内容
     * @param templateObj 模板对象
     * @param chain 工作流链
     * @return 解析后的字符串
     */
    private String parseTemplate(Object templateObj, Chain chain) {
        if (templateObj instanceof Map) {
            Map<String, Object> templateMap = (Map<String, Object>) templateObj;
            String type = (String) templateMap.get("type");
            Object content = templateMap.get("content");

            if ("template".equals(type) && content instanceof String) {
                return SpringExpressionParser.getInstance().getVueStringValue((String) content, chain.getMemory());
            } else if (RefType.CONSTANT.name().toLowerCase().equals(type)) {
                return content != null ? content.toString() : null;
            } else if (RefType.REF.name().toLowerCase().equals(type) && content instanceof List) {
                // 修复：prompt/systemPrompt 配置为 ref 引用时，从 memory 解析上游节点输出
                // 此前该分支被遗漏，直接返回空串，导致 LLM 收到空 prompt 仍发请求
                return resolveRef((List<?>) content, chain);
            }
        } else if (templateObj instanceof String) {
            return (String) templateObj;
        }
        return "";
    }

    /**
     * 解析 ref 引用路径，支持任意深度路径（nodeId → field → subField → ...）
     * 例如 ["start_0","query"] 取 memory[start_0][query]
     * 例如 ["start_0","output","field"] 取 memory[start_0][output][field]
     *
     * @param refPath 引用路径数组
     * @param chain 工作流链
     * @return 解析后的字符串值，路径不存在返回 null
     */
    private String resolveRef(List<?> refPath, Chain chain) {
        if (refPath == null || refPath.size() < 2) {
            return null;
        }
        String nodeId = refPath.get(0).toString();
        Object current = chain.getMemory().get(nodeId);
        // 逐层深入解析：[1] → [2] → ...
        for (int i = 1; i < refPath.size(); i++) {
            if (current instanceof Map) {
                current = ((Map<?, ?>) current).get(refPath.get(i).toString());
            } else {
                return null;
            }
        }
        return current != null ? current.toString() : null;
    }

    @Override
    public List<Parameter> getOutputParameters() {
        List<Parameter> parameters = new ArrayList<>();

        Parameter resultParam = new Parameter();
        resultParam.setName("result");
        resultParam.setRefValue(Arrays.asList("result"));
        resultParam.setRefType(RefType.REF);
        resultParam.setType(DataType.String);
        parameters.add(resultParam);

        return parameters;
    }

    /**
     * LLM请求配置
     */
    @Data
    public static class LlmRequest {
        private String modelName;
        private String apiKey;
        private String apiHost;
        private Double temperature;
        private String systemPrompt;
        private String prompt;
    }

    /**
     * 超时配置
     */
    @Data
    public static class TimeoutConfig {
        private int timeout;
        private int retryTimes;
    }


    @Override
    public NodeTypeEnum getNodeType() {
        return NodeTypeEnum.LLM;
    }

    @Override
    protected Map<String, Object> getParametersData(Chain chain) {
        return chain.getMemory();
    }
}

