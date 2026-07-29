package cn.boommanpro.gaia.workflow.app.service.impl;

import cn.boommanpro.gaia.workflow.app.executor.AsyncWorkflowExecutor;
import cn.boommanpro.gaia.workflow.app.executor.SingleNodeExecutor;
import cn.boommanpro.gaia.workflow.app.domain.testrun.input.SingleNodeRunInput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.input.TaskCancelInput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.input.TaskRunInput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.model.NodeStatus;
import cn.boommanpro.gaia.workflow.app.domain.testrun.model.TaskInfo;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.SingleNodeRunOutput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.TaskCancelOutput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.TaskReportOutput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.TaskResultOutput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.TaskRunOutput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.TaskValidateOutput;
import cn.boommanpro.gaia.workflow.app.service.TaskRepository;
import cn.boommanpro.gaia.workflow.app.service.WorkflowTaskService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.UUID;

/**
 * 工作流任务服务实现类
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 * @date 2025/08/22 14:35
 */
@Service
public class WorkflowTaskServiceImpl implements WorkflowTaskService {

    private static final Logger logger = LoggerFactory.getLogger(WorkflowTaskServiceImpl.class);

    private final TaskRepository taskRepository;
    private final AsyncWorkflowExecutor asyncWorkflowExecutor;
    private final SingleNodeExecutor singleNodeExecutor;

    @Autowired
    public WorkflowTaskServiceImpl(TaskRepository taskRepository, AsyncWorkflowExecutor asyncWorkflowExecutor,
                                   SingleNodeExecutor singleNodeExecutor) {
        this.taskRepository = taskRepository;
        this.asyncWorkflowExecutor = asyncWorkflowExecutor;
        this.singleNodeExecutor = singleNodeExecutor;
    }

    @Override
    public TaskValidateOutput validateWorkflow(TaskRunInput input) {
        logger.debug("验证工作流: {}", input);
        // 验证工作流Schema
        if (input.getSchema() == null || input.getSchema().isEmpty()) {
            logger.warn("工作流Schema为空");
            return TaskValidateOutput.fail(Arrays.asList("Schema不能为空"));
        }
        return TaskValidateOutput.success();
    }

    @Override
    public TaskRunOutput runWorkflow(TaskRunInput input) {
        logger.info("运行工作流: {}", input);
        // 生成任务ID
        String taskId = generateTaskId();
        logger.debug("生成任务ID: {}", taskId);

        // 创建任务信息并存储
        TaskInfo taskInfo = createTaskInfo(input);
        taskRepository.saveTask(taskId, taskInfo);

        // 异步执行工作流
        asyncWorkflowExecutor.executeAsync(taskId, taskInfo, input);

        return new TaskRunOutput(taskId);
    }

    /**
     * 生成任务ID
     *
     * @return 任务ID
     */
    private String generateTaskId() {
        return UUID.randomUUID().toString();
    }

    /**
     * 创建任务信息
     *
     * @param input 工作流输入参数
     * @return 任务信息
     */
    private TaskInfo createTaskInfo(TaskRunInput input) {
        return new TaskInfo(input.getSchema(), input.getInputs());
    }

    @Override
    public TaskReportOutput getTaskReport(String taskId) {
        logger.debug("获取任务报告: {}", taskId);
        TaskInfo taskInfo = taskRepository.getTask(taskId);
        if (taskInfo == null) {
            logger.warn("任务不存在: {}", taskId);
            return new TaskReportOutput(); // 返回默认状态
        }

        return createTaskReportOutput(taskInfo);
    }

    /**
     * 创建任务报告输出
     *
     * @param taskInfo 任务信息
     * @return 任务报告输出
     */
    private TaskReportOutput createTaskReportOutput(TaskInfo taskInfo) {
        TaskReportOutput report = new TaskReportOutput();
        report.setWorkflowStatus(taskInfo.getWorkflowStatus());
        report.setInputs(taskInfo.getInputs());
        report.setOutputs(taskInfo.getOutputs());
        report.setMessages(taskInfo.getMessages());
        report.setReports(taskInfo.getNodeReports());
        return report;
    }

    @Override
    public TaskCancelOutput cancelTask(TaskCancelInput input) {
        String taskId = input.getTaskID();
        logger.info("取消任务: {}", taskId);

        TaskInfo taskInfo = taskRepository.getTask(taskId);
        if (taskInfo == null) {
            logger.warn("任务不存在: {}", taskId);
            return new TaskCancelOutput(false);
        }

        // 如果任务已终止，无法取消
        if (taskInfo.getWorkflowStatus().isTerminated()) {
            logger.warn("任务已终止，无法取消: {}", taskId);
            return new TaskCancelOutput(false);
        }

        // 设置任务状态为已取消
        updateTaskStatusToCanceled(taskId, taskInfo);

        return new TaskCancelOutput(true);
    }

    /**
     * 更新任务状态为已取消
     *
     * @param taskId 任务ID
     * @param taskInfo 任务信息
     */
    private void updateTaskStatusToCanceled(String taskId, TaskInfo taskInfo) {
        taskInfo.getWorkflowStatus().setStatus(NodeStatus.CANCELED.getValue());
        taskInfo.getWorkflowStatus().setTerminated(true);
        taskRepository.updateTask(taskId, taskInfo);
    }

    @Override
    public TaskResultOutput getTaskResult(String taskId) {
        logger.debug("获取任务结果: {}", taskId);
        TaskInfo taskInfo = taskRepository.getTask(taskId);
        if (taskInfo == null) {
            logger.warn("任务不存在: {}", taskId);
            return new TaskResultOutput(null);
        }

        if (!taskInfo.getWorkflowStatus().isTerminated()) {
            logger.warn("任务未终止: {}", taskId);
            return new TaskResultOutput(null);
        }

        return new TaskResultOutput(taskInfo.getOutputs());
    }

    @Override
    public SingleNodeRunOutput runSingleNode(SingleNodeRunInput input) {
        logger.info("执行单节点测试: nodeType={}", input.getNode() != null ? "present" : "null");
        return singleNodeExecutor.execute(input);
    }
}

