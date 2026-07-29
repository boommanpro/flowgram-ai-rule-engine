package cn.boommanpro.gaia.workflow.app.domain.testrun.input;

import lombok.Data;

import java.util.Map;

/**
 * 单节点执行输入参数
 * <p>
 * 用于在工作流编辑器中独立测试单个节点的执行效果，
 * 用户可提供模拟的上游节点输出（memory 上下文）以解析 ref/template 类型的引用。
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 */
@Data
public class SingleNodeRunInput {

    /**
     * 节点 JSON 字符串（编辑器中节点的 toJSON 结果）
     */
    private String node;

    /**
     * 模拟的内存上下文，key 为节点 ID，value 为该节点的输出 Map。
     * 用于解析目标节点中 ref 类型引用（如 {"start_0": {"query": "hello"}}）。
     * 也可直接提供顶层 key-value（如 {"query": "hello"}）用于模板解析。
     */
    private Map<String, Object> inputs;
}
