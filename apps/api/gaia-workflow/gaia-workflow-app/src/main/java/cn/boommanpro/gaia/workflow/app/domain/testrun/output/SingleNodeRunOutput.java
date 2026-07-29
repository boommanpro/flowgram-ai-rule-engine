package cn.boommanpro.gaia.workflow.app.domain.testrun.output;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 单节点执行输出结果
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 */
@Data
@NoArgsConstructor
public class SingleNodeRunOutput {

    /**
     * 是否执行成功
     */
    private boolean success;

    /**
     * 节点类型
     */
    private String nodeType;

    /**
     * 解析后的输出结果（基于节点声明的 outputParameters）
     */
    private Map<String, Object> outputs;

    /**
     * 节点 execute 方法的原始返回值
     */
    private Map<String, Object> executeResult;

    /**
     * 执行耗时（毫秒）
     */
    private long timeCost;

    /**
     * 错误信息（执行失败时）
     */
    private String error;

    public static SingleNodeRunOutput success(String nodeType, Map<String, Object> outputs,
                                                Map<String, Object> executeResult, long timeCost) {
        SingleNodeRunOutput output = new SingleNodeRunOutput();
        output.success = true;
        output.nodeType = nodeType;
        output.outputs = outputs;
        output.executeResult = executeResult;
        output.timeCost = timeCost;
        return output;
    }

    public static SingleNodeRunOutput fail(String nodeType, String error, long timeCost) {
        SingleNodeRunOutput output = new SingleNodeRunOutput();
        output.success = false;
        output.nodeType = nodeType;
        output.error = error;
        output.timeCost = timeCost;
        return output;
    }
}
