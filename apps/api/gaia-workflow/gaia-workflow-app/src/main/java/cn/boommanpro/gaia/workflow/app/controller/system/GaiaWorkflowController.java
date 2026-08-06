package cn.boommanpro.gaia.workflow.app.controller.system;

import cn.boommanpro.gaia.workflow.infra.manage.entity.GaiaWorkflow;
import cn.boommanpro.gaia.workflow.infra.manage.entity.GaiaWorkflowTemplate;
import cn.boommanpro.gaia.workflow.infra.manage.entity.GaiaWorkflowVersion;
import cn.boommanpro.gaia.workflow.infra.manage.service.GaiaWorkflowService;
import cn.boommanpro.gaia.workflow.infra.manage.service.GaiaWorkflowTemplateService;
import cn.boommanpro.gaia.workflow.infra.manage.service.GaiaWorkflowVersionService;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/workflow")
public class GaiaWorkflowController {

    private final GaiaWorkflowService workflowService;

    private final GaiaWorkflowTemplateService templateService;

    private final GaiaWorkflowVersionService versionService;

    public GaiaWorkflowController(GaiaWorkflowService workflowService,
                                  @Qualifier("gaiaWorkflowTemplateAppService") GaiaWorkflowTemplateService templateService,
                                  GaiaWorkflowVersionService versionService) {
        this.workflowService = workflowService;
        this.templateService = templateService;
        this.versionService = versionService;
    }

    /**
     * 获取所有工作流列表
     */
    @GetMapping("/list")
    public List<GaiaWorkflow> listWorkflows() {
        return workflowService.list();
    }

    /**
     * 根据ID获取工作流详情
     */
    @GetMapping("/{id}")
    public GaiaWorkflow getWorkflowById(@PathVariable Long id) {
        return workflowService.getById(id);
    }

    /**
     * 根据工作流编码获取工作流详情
     */
    @GetMapping("/code/{workflowCode}")
    public GaiaWorkflow getWorkflowByCode(@PathVariable String workflowCode) {
        return workflowService.getOne(
            new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<GaiaWorkflow>()
                .eq("workflow_code", workflowCode)
                .eq("is_deleted", 0)
        );
    }

    /**
     * 创建新工作流
     * 始终创建初始版本：有模板则用模板数据，无模板则用最小默认数据
     */
    @PostMapping("/create")
    public boolean createWorkflow(@RequestBody GaiaWorkflow workflow) {
        // 保存工作流
        workflow.setCreatedAt(LocalDateTime.now());
        workflow.setUpdatedAt(LocalDateTime.now());
        boolean workflowSaved = workflowService.save(workflow);

        if (!workflowSaved) {
            return false;
        }

        // 确定初始版本数据来源
        String versionDesc;
        String workflowData;

        if (workflow.getTemplateCode() != null) {
            // 根据模板编码查找模板
            GaiaWorkflowTemplate template = templateService.getOne(
                new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<GaiaWorkflowTemplate>()
                    .eq("template_code", workflow.getTemplateCode())
                    .eq("is_deleted", 0)
            );

            if (template != null) {
                versionDesc = "基于模板 [" + template.getTemplateName() + "] 创建的初始版本";
                workflowData = template.getTemplateData();
            } else {
                versionDesc = "初始版本";
                workflowData = DEFAULT_WORKFLOW_DATA;
            }
        } else {
            versionDesc = "初始版本";
            workflowData = DEFAULT_WORKFLOW_DATA;
        }

        // 创建初始版本
        GaiaWorkflowVersion version = new GaiaWorkflowVersion();
        version.setWorkflowCode(workflow.getWorkflowCode());
        version.setVersionNumber("v1.0");
        version.setVersionDesc(versionDesc);
        version.setWorkflowData(workflowData);
        version.setCreatedBy("system");
        version.setIsCurrent(1);
        version.setCreatedAt(LocalDateTime.now());

        boolean versionSaved = versionService.save(version);

        if (versionSaved) {
            // 更新工作流的当前版本ID
            workflow.setCurrentVersionId(version.getId());
            workflowService.updateById(workflow);
        }

        return true;
    }

    /**
     * 新工作流的默认最小数据：包含 Start 与 End 节点
     * Start 节点定义 query 入参（string），End 节点直接引用并返回 start_0.query
     */
    private static final String DEFAULT_WORKFLOW_DATA =
        "{\"nodes\":[" +
        "{\"id\":\"start_0\",\"type\":\"start\",\"meta\":{\"position\":{\"x\":180,\"y\":200}}," +
        "\"data\":{\"title\":\"Start\",\"description\":\"start node\"," +
        "\"outputs\":{\"type\":\"object\",\"properties\":{\"query\":{\"type\":\"string\",\"default\":\"Hello Flow.\"}}}}}," +
        "{\"id\":\"end_0\",\"type\":\"end\",\"meta\":{\"position\":{\"x\":180,\"y\":420}}," +
        "\"data\":{\"title\":\"End\",\"description\":\"end node\"," +
        "\"inputsValues\":{\"query\":{\"type\":\"ref\",\"content\":[\"start_0\",\"query\"]}}," +
        "\"inputs\":{\"properties\":{\"query\":{\"type\":\"string\"}}}}}" +
        "],\"edges\":[{\"sourceNodeID\":\"start_0\",\"targetNodeID\":\"end_0\"}]}";

    /**
     * 更新工作流
     */
    @PutMapping("/update")
    public boolean updateWorkflow(@RequestBody GaiaWorkflow workflow) {
        workflow.setUpdatedAt(LocalDateTime.now());
        return workflowService.updateById(workflow);
    }

    /**
     * 删除工作流
     */
    @DeleteMapping("/delete/{id}")
    public boolean deleteWorkflow(@PathVariable Long id) {
        return workflowService.removeById(id);
    }
}
