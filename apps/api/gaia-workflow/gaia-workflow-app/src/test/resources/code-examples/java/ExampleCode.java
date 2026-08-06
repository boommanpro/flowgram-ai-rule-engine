import java.util.HashMap;
import java.util.Map;

/**
 * Java 代码节点示例。
 * <p>
 * 约束：
 * <ul>
 *   <li>需提供 public 无参构造（默认即满足）</li>
 *   <li>需提供 {@code execute(Map<String,Object>)} 方法，返回 Map 作为节点输出</li>
 *   <li>无需实现 CodeExecute 接口，DynamicCompileNode 会通过反射调用 execute</li>
 * </ul>
 * 输入参数 name（String），输出 greeting / length。
 */
public class ExampleCode {

    public Map<String, Object> execute(Map<String, Object> inputs) {
        Map<String, Object> result = new HashMap<>();
        Object name = inputs.get("name");
        String nameStr = name == null ? "" : name.toString();
        result.put("greeting", "Hello, " + nameStr + "!");
        result.put("length", nameStr.length());
        return result;
    }
}
