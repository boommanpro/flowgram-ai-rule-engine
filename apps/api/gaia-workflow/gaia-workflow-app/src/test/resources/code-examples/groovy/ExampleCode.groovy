/**
 * Groovy 代码节点示例。
 * <p>
 * 约束：
 * <ul>
 *   <li>GroovyClassLoader.parseClass 解析脚本，类定义会被识别为主类</li>
 *   <li>需提供 execute(Map) 方法，返回 Map 作为节点输出</li>
 *   <li>可使用 Groovy 语法糖（字符串插值、def 等）</li>
 * </ul>
 * 输入参数 name（String），输出 greeting / upper。
 */
class ExampleCode {

    Map<String, Object> execute(Map<String, Object> inputs) {
        def result = new HashMap<String, Object>()
        def name = inputs.get("name") ?: ""
        result.put("greeting", "Hello, ${name}!".toString())
        result.put("upper", name.toString().toUpperCase())
        return result
    }
}
