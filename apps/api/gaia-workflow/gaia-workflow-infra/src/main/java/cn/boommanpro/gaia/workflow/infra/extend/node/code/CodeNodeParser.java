package cn.boommanpro.gaia.workflow.infra.extend.node.code;

import cn.boommanpro.gaia.workflow.base.GaiaWorkflow;
import cn.boommanpro.gaia.workflow.base.tools.ParameterParseUtils;
import cn.boommanpro.gaia.workflow.base.type.DataType;
import cn.boommanpro.gaia.workflow.base.model.Parameter;
import cn.boommanpro.gaia.workflow.base.type.RefType;
import cn.boommanpro.gaia.workflow.infra.extend.node.BaseNodeParser;
import cn.hutool.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 代码功能
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 * @date 2025/05/17 11:35
 */
public class CodeNodeParser extends BaseNodeParser<CodeNode> {

    private static final String INPUTS_JSON_PATH = "$.data.inputs.properties";
    private static final String INPUTS_VALUES_JSON_PATH = "$.data.inputsValues";
    private static final String OUTPUTS_JSON_PATH = "$.data.outputs.properties";
    private static final String OUTPUTS_VALUES_JSON_PATH = "$.data.outputsValues";
    private static final String SCRIPT_CONTENT_PATH = "$.data.script.content";
    private static final String SCRIPT_LANGUAGE_PATH = "$.data.script.language";

    @Override
    public CodeNode buildInstance(JSONObject nodeJSONObject, GaiaWorkflow workflow) {
        String scriptContent = ParameterParseUtils.getStringByPath(nodeJSONObject, SCRIPT_CONTENT_PATH);
        String scriptLanguage = ParameterParseUtils.getStringByPath(nodeJSONObject, SCRIPT_LANGUAGE_PATH);

        CodeNode codeNode;
        if (isJavaScript(scriptLanguage)) {
            // JavaScript（含 null/jsReturn/javascript/js）统一走 GraalJS 引擎
            codeNode = new JsFunExecNode(scriptContent);
        } else {
            // 其他语言（java/groovy）使用 DynamicCompileNode 动态编译
            codeNode = new DynamicCompileNode(scriptContent, scriptLanguage);
        }

        // 使用通用工具类解析参数
        JSONObject inputsSchema = ParameterParseUtils.getJSONObjectByPath(nodeJSONObject, INPUTS_JSON_PATH);
        JSONObject inputsValues = ParameterParseUtils.getJSONObjectByPath(nodeJSONObject, INPUTS_VALUES_JSON_PATH);
        codeNode.setParameters(parseNodeParameters(inputsSchema, inputsValues));

        JSONObject outputsSchema = ParameterParseUtils.getJSONObjectByPath(nodeJSONObject, OUTPUTS_JSON_PATH);
        JSONObject outputsValues = ParameterParseUtils.getJSONObjectByPath(nodeJSONObject, OUTPUTS_VALUES_JSON_PATH);
        codeNode.setOutputParameters(parseNodeParameters(outputsSchema, outputsValues));

        return codeNode;
    }

    /**
     * 判断脚本语言是否为 JavaScript 系列。
     * null / "jsReturn" / "javascript" / "js" 均走 GraalJS 引擎，
     * 因为 {@link cn.boommanpro.gaia.workflow.infra.extend.node.code.compiler.CompilerEngineEnum}
     * 仅注册了 JAVA 与 GROOVY，DynamicCompileNode 无法处理 JS。
     */
    private static boolean isJavaScript(String scriptLanguage) {
        return scriptLanguage == null
                || "jsReturn".equalsIgnoreCase(scriptLanguage)
                || "javascript".equalsIgnoreCase(scriptLanguage)
                || "js".equalsIgnoreCase(scriptLanguage);
    }

    public static List<Parameter> parseNodeParameters(JSONObject schemaObject, JSONObject valueMapObject) {
        if (schemaObject == null) {
            return Collections.emptyList();
        }

        List<Parameter> parameters = new ArrayList<>();

        for (Map.Entry<String, Object> entry : schemaObject.entrySet()) {
            JSONObject paramJson = (JSONObject) entry.getValue();
            String key = entry.getKey();
            Parameter parameter = new Parameter();
            parameter.setName(key);
            parameter.setType(DataType.ofValue(paramJson.getStr("type")));

            // 设置是否必需
            parameter.setRequire(Optional.ofNullable(paramJson.getBool("isPropertyRequired"))
                    .orElse(Optional.ofNullable(paramJson.getBool("required")).orElse(false)));

            // 处理参数值
            if (valueMapObject != null && valueMapObject.containsKey(key)) {
                JSONObject valueObject = valueMapObject.getJSONObject(key);
                if (valueObject != null) {
                    parameter.setRefType(RefType.from(valueObject.getStr("type")));

                    if (parameter.getRefType() == RefType.REF) {
                        List<String> refValues = valueObject.getJSONArray("content").stream()
                                .map(Object::toString)
                                .collect(Collectors.toList());
                        parameter.setRefValue(refValues);

//                        // 处理额外信息
//                        if (valueObject.containsKey("extra")) {
//                            parameter.setExtra(valueObject.getJSONObject("extra"));
//                        }
                    } else {
                        parameter.setDefaultValue(valueObject.getStr("content"));
                    }
                }
            } else {
                parameter.setRefType(RefType.REF);
                parameter.setRefValue(Collections.singletonList(key));
            }

            parameters.add(parameter);
        }

        return parameters;
    }
}
