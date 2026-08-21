package cn.boommanpro.gaia.workflow.app.node;

import cn.boommanpro.gaia.workflow.base.GaiaWorkflow;
import cn.boommanpro.gaia.workflow.base.model.Chain;
import cn.boommanpro.gaia.workflow.infra.extend.node.loop.LoopNode;
import cn.boommanpro.gaia.workflow.infra.extend.node.loop.LoopNodeParser;
import cn.hutool.json.JSONUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 循环节点稳健性测试。
 * <p>
 * 验证两个已知问题：
 * <ol>
 *   <li>loopFor 指向基本类型数组（int[]/long[]/boolean[] 等）时，
 *       convertToList 强转 Object[] 会抛 ClassCastException → 应逐元素转换</li>
 *   <li>maxLoopCount 字段解析后从未使用 → execute 应受该上限约束</li>
 * </ol>
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 */
@DisplayName("循环节点稳健性测试")
class LoopNodeRobustnessTest extends AbstractNodeTest {

    @Test
    @DisplayName("convertToList: 基本类型数组 int[] 逐元素转 List，不抛异常")
    void convertToListShouldHandlePrimitiveArray() throws Exception {
        LoopNode loop = new LoopNode();
        Method m = LoopNode.class.getDeclaredMethod("convertToList", Object.class);
        m.setAccessible(true);

        // 当前实现强转 (Object[]) 会抛 ClassCastException → 修复后返回 [1,2,3]
        List<?> result = (List<?>) m.invoke(loop, new int[]{1, 2, 3});
        assertEquals(3, result.size(), "int[] 应转换为 3 个元素的 List");
        assertEquals(1, ((Integer) result.get(0)).intValue());
        assertEquals(3, ((Integer) result.get(2)).intValue());

        // 其余基本类型数组同样不应抛异常
        assertDoesNotThrow(() -> m.invoke(loop, new boolean[]{true, false}));
        assertDoesNotThrow(() -> m.invoke(loop, new double[]{1.5, 2.5}));
    }

    @Test
    @DisplayName("LoopNodeParser: data.maxLoopCount 应被解析到节点")
    void parserShouldLoadMaxLoopCount() {
        String json = JSONUtil.createObj()
                .set("id", "loop_0")
                .set("type", "loop")
                .set("data", JSONUtil.createObj()
                        .set("loopFor", JSONUtil.createObj().set("type", "constant").set("content", "[]"))
                        .set("maxLoopCount", 3))
                .toString();

        LoopNode node = (LoopNode) new LoopNodeParser().parse(JSONUtil.parseObj(json), new GaiaWorkflow("{}"));
        assertEquals(3, node.getMaxLoopCount(),
                "maxLoopCount 应被解析（当前实现未解析，恒为 0）");
    }

    @Test
    @DisplayName("execute: 迭代次数受 maxLoopCount 约束（5 元素、上限 2 → 只迭代 2 次）")
    void executeShouldBeLimitedByMaxLoopCount() {
        // 父链
        Chain parent = new Chain();
        parent.getMemory().put("arr", Arrays.asList(1, 2, 3, 4, 5));

        // LoopNode：遍历 5 元素常量列表，输出收集到 count
        LoopNode loop = new LoopNode();
        loop.setId("loop_0");
        loop.setParent(parent);

        LoopNode.LoopFor loopFor = new LoopNode.LoopFor();
        loopFor.setType("constant");
        loopFor.setContent(Arrays.asList(1, 2, 3, 4, 5));
        loop.setLoopFor(loopFor);

        LoopNode.LoopOutput out = new LoopNode.LoopOutput();
        out.setType("constant");
        out.setContent("x");
        Map<String, LoopNode.LoopOutput> loopOutputs = new HashMap<>();
        loopOutputs.put("count", out);
        loop.setLoopOutputs(loopOutputs);
        loop.setMaxLoopCount(2);

        Map<String, Object> result = loop.execute(parent);
        Object countValue = result.get("count");
        assertNotNull(countValue, "应收集到 count 输出");
        assertInstanceOf(List.class, countValue, "count 应为收集列表");
        List<?> countList = (List<?>) countValue;
        assertEquals(2, countList.size(),
                "上限 2 时只应迭代 2 次，实际 " + countList.size());
    }
}