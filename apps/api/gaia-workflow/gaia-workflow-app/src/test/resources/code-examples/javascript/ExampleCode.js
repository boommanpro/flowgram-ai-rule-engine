/**
 * JavaScript 代码节点示例（GraalJS 引擎）。
 * <p>
 * 约束：
 * <ul>
 *   <li>代码会被包裹为 function jsFunc(){ &lt;code&gt; }; jsFunc();</li>
 *   <li>最后一个表达式作为返回值，需为对象（会被强转为 Map）</li>
 *   <li>输入参数以顶层变量形式注入 bindings，直接用变量名访问</li>
 * </ul>
 * 输入参数 name（String），输出 greeting / length。
 */
var nameStr = name == null ? "" : name.toString();
var result = {
    greeting: "Hello, " + nameStr + "!",
    length: nameStr.length
};
result;
