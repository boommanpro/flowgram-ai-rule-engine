package cn.boommanpro.gaia.workflow.infra.extend.node.code;

import cn.boommanpro.gaia.workflow.base.model.Chain;
import lombok.extern.slf4j.Slf4j;
import org.graalvm.polyglot.Value;

import javax.script.Bindings;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;
import java.util.HashMap;
import java.util.Map;

/**
 * JavaScript 代码节点（GraalJS 引擎）。
 * <p>
 * 直接 eval 用户代码（不包裹 function），最后一个表达式的值即为返回值。
 * 输入参数以顶层变量形式注入 bindings，代码中直接用变量名访问。
 * 返回值需为对象（会被转换为 Map）。
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 * @date 2025/06/11 14:46
 */
@Slf4j
public class JsFunExecNode extends CodeNode {

    private final String code;

    public JsFunExecNode(String code) {
        this.code = code;
    }

    @Override
    public Map<String, Object> execute(Chain chain) {
        ScriptEngine engine = (new ScriptEngineManager()).getEngineByName("graal.js");
        if (engine == null) {
            throw new RuntimeException("未找到 GraalJS 引擎，请确认依赖配置");
        }
        Bindings bindings = engine.createBindings();
        bindings.put("polyglot.js.allowHostAccess", true);
        bindings.put("polyglot.js.allowHostClassLookup", true);
        Map<String, Object> parameterValues = chain.getParametersData(this);
        if (parameterValues != null) {
            bindings.putAll(parameterValues);
        }

        Map<String, Object> tempResult = new HashMap<>();
        bindings.put("_chain", chain);
        bindings.put("_result", tempResult);

        try {
            Object evalResult = engine.eval(code, bindings);
            return convertToMap(evalResult);
        } catch (ScriptException e) {
            throw new RuntimeException("GraalJS 执行失败", e);
        }
    }

    /**
     * 将 GraalJS eval 结果转换为 Map。
     * <p>
     * GraalJS ScriptEngine 返回 {@link Value} 对象而非 Map，
     * 需通过 polyglot API 提取 hash entries。
     *
     * @param result eval 返回值
     * @return Map 形式的结果
     */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> convertToMap(Object result) {
        if (result == null) {
            return new HashMap<>();
        }
        if (result instanceof Map) {
            return (Map<String, Object>) result;
        }
        // GraalJS 返回 Value 对象，通过 polyglot member API 转换
        Value value = Value.asValue(result);
        if (value.hasMembers()) {
            Map<String, Object> map = new HashMap<>();
            for (String key : value.getMemberKeys()) {
                Value val = value.getMember(key);
                map.put(key, val.as(Object.class));
            }
            return map;
        }
        // 标量结果包装为 result 字段
        Map<String, Object> map = new HashMap<>();
        map.put("result", result);
        return map;
    }

    @Override
    protected Map<String, Object> getParametersData(Chain chain) {
        return chain.getParametersData(this);
    }
}
