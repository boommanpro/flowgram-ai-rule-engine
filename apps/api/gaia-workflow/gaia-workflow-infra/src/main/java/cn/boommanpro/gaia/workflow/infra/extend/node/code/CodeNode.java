package cn.boommanpro.gaia.workflow.infra.extend.node.code;

import cn.boommanpro.gaia.workflow.base.model.Chain;
import cn.boommanpro.gaia.workflow.base.type.NodeTypeEnum;
import cn.boommanpro.gaia.workflow.infra.extend.node.BaseNode;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

@Slf4j
public class CodeNode extends BaseNode {

    @Override
    public Map<String, Object> execute(Chain chain) {
        return chain.getMemory();
    }


    @Override
    public NodeTypeEnum getNodeType() {
        return NodeTypeEnum.CODE;
    }

    @Override
    protected Map<String, Object> getParametersData(Chain chain) {
        return chain.getMemory();
    }
}
