package cn.boommanpro.gaia.workflow.app.service;

import cn.boommanpro.gaia.workflow.app.domain.testrun.input.SingleNodeRunInput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.input.TaskCancelInput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.input.TaskRunInput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.SingleNodeRunOutput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.TaskCancelOutput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.TaskReportOutput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.TaskResultOutput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.TaskRunOutput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.TaskValidateOutput;

/**
 * 工作流任务服务接口
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 * @date 2025/08/22 14:30
 */
public interface WorkflowTaskService {

    /**
     * 验证工作流
     *
     * @param input 工作流输入参数
     * @return 验证结果
     */
    TaskValidateOutput validateWorkflow(TaskRunInput input);

    /**
     * 运行工作流
     *
     * @param input 工作流输入参数
     * @return 运行结果
     */
    TaskRunOutput runWorkflow(TaskRunInput input);

    /**
     * 获取任务报告
     *
     * @param taskId 任务ID
     * @return 任务报告
     */
    TaskReportOutput getTaskReport(String taskId);

    /**
     * 取消任务
     *
     * @param input 取消任务输入参数
     * @return 取消结果
     */
    TaskCancelOutput cancelTask(TaskCancelInput input);

    /**
     * 获取任务结果
     *
     * @param taskId 任务ID
     * @return 任务结果
     */
    TaskResultOutput getTaskResult(String taskId);

    /**
     * 执行单个节点（用于节点级测试）
     *
     * @param input 节点 JSON 与模拟内存上下文
     * @return 执行结果
     */
    SingleNodeRunOutput runSingleNode(SingleNodeRunInput input);
}

