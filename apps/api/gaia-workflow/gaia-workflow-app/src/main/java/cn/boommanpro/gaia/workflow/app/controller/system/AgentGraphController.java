package cn.boommanpro.gaia.workflow.app.controller.system;

import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGraphEdge;
import cn.boommanpro.gaia.workflow.infra.manage.entity.AgentGraphNode;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentGraphEdgeService;
import cn.boommanpro.gaia.workflow.infra.manage.service.AgentGraphNodeService;
import cn.hutool.json.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Agent 知识图谱管理
 */
@Slf4j
@RestController
@RequestMapping("/api/agent/graph")
public class AgentGraphController {

    private final AgentGraphNodeService nodeService;
    private final AgentGraphEdgeService edgeService;

    public AgentGraphController(AgentGraphNodeService nodeService,
                               AgentGraphEdgeService edgeService) {
        this.nodeService = nodeService;
        this.edgeService = edgeService;
    }

    // ==================== Node endpoints ====================

    /**
     * 获取节点列表，支持按 nodeType 与 title/node_key 关键字过滤
     */
    @GetMapping("/node/list")
    public List<AgentGraphNode> listNodes(@RequestParam(required = false) String nodeType,
                                          @RequestParam(required = false) String keyword) {
        QueryWrapper<AgentGraphNode> wrapper = new QueryWrapper<>();
        if (nodeType != null && !nodeType.isEmpty()) {
            wrapper.eq("node_type", nodeType);
        }
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like("title", keyword).or().like("node_key", keyword));
        }
        return nodeService.list(wrapper);
    }

    /**
     * 根据 node_key 获取节点
     */
    @GetMapping("/node/{nodeKey}")
    public ResponseEntity<AgentGraphNode> getNode(@PathVariable String nodeKey) {
        AgentGraphNode node = nodeService.getOne(
            new QueryWrapper<AgentGraphNode>().eq("node_key", nodeKey));
        return ResponseEntity.ok(node);
    }

    /**
     * 新增或更新节点（按 node_key upsert）
     */
    @PostMapping("/node/save")
    public AgentGraphNode saveNode(@RequestBody AgentGraphNode node) {
        AgentGraphNode existing = nodeService.getOne(
            new QueryWrapper<AgentGraphNode>().eq("node_key", node.getNodeKey()));
        if (existing != null) {
            node.setId(existing.getId());
            node.setCreatedAt(existing.getCreatedAt());
            node.setUpdatedAt(LocalDateTime.now().toString());
            nodeService.updateById(node);
        } else {
            node.setCreatedAt(LocalDateTime.now().toString());
            node.setUpdatedAt(LocalDateTime.now().toString());
            nodeService.save(node);
        }
        return node;
    }

    /**
     * 软删除节点及其所有关联边（source_key 或 target_key 命中）
     */
    @DeleteMapping("/node/{nodeKey}")
    public boolean deleteNode(@PathVariable String nodeKey) {
        edgeService.remove(new QueryWrapper<AgentGraphEdge>()
            .and(w -> w.eq("source_key", nodeKey).or().eq("target_key", nodeKey)));
        return nodeService.remove(new QueryWrapper<AgentGraphNode>().eq("node_key", nodeKey));
    }

    // ==================== Edge endpoints ====================

    /**
     * 获取边列表，支持按 sourceKey/targetKey/edgeType 过滤
     */
    @GetMapping("/edge/list")
    public List<AgentGraphEdge> listEdges(@RequestParam(required = false) String sourceKey,
                                          @RequestParam(required = false) String targetKey,
                                          @RequestParam(required = false) String edgeType) {
        QueryWrapper<AgentGraphEdge> wrapper = new QueryWrapper<>();
        if (sourceKey != null && !sourceKey.isEmpty()) {
            wrapper.eq("source_key", sourceKey);
        }
        if (targetKey != null && !targetKey.isEmpty()) {
            wrapper.eq("target_key", targetKey);
        }
        if (edgeType != null && !edgeType.isEmpty()) {
            wrapper.eq("edge_type", edgeType);
        }
        return edgeService.list(wrapper);
    }

    /**
     * 新增或更新边（有 id 则更新，否则创建）
     */
    @PostMapping("/edge/save")
    public AgentGraphEdge saveEdge(@RequestBody AgentGraphEdge edge) {
        if (edge.getId() != null) {
            edgeService.updateById(edge);
        } else {
            edge.setCreatedAt(LocalDateTime.now().toString());
            edgeService.save(edge);
        }
        return edge;
    }

    /**
     * 按 id 软删除边
     */
    @DeleteMapping("/edge/{id}")
    public boolean deleteEdge(@PathVariable Long id) {
        return edgeService.removeById(id);
    }

    // ==================== Graph query endpoints ====================

    /**
     * 子图检索：按过滤条件找到种子节点，扩展到所有相连边与端点节点
     */
    @GetMapping("/subgraph")
    public JSONObject subgraph(@RequestParam(required = false) String nodeType,
                               @RequestParam(required = false) String keyword) {
        QueryWrapper<AgentGraphNode> nodeWrapper = new QueryWrapper<>();
        if (nodeType != null && !nodeType.isEmpty()) {
            nodeWrapper.eq("node_type", nodeType);
        }
        if (keyword != null && !keyword.isEmpty()) {
            nodeWrapper.and(w -> w.like("title", keyword).or().like("node_key", keyword));
        }
        List<AgentGraphNode> seedNodes = nodeService.list(nodeWrapper);

        Set<String> nodeKeys = new HashSet<>();
        for (AgentGraphNode n : seedNodes) {
            nodeKeys.add(n.getNodeKey());
        }

        if (nodeKeys.isEmpty()) {
            return new JSONObject()
                .set("nodes", Collections.emptyList())
                .set("edges", Collections.emptyList());
        }

        List<AgentGraphEdge> edges = edgeService.list(new QueryWrapper<AgentGraphEdge>()
            .and(w -> w.in("source_key", nodeKeys).or().in("target_key", nodeKeys)));

        Set<String> expandedKeys = new HashSet<>(nodeKeys);
        for (AgentGraphEdge e : edges) {
            expandedKeys.add(e.getSourceKey());
            expandedKeys.add(e.getTargetKey());
        }

        List<AgentGraphNode> nodes = nodeService.list(
            new QueryWrapper<AgentGraphNode>().in("node_key", expandedKeys));

        return new JSONObject()
            .set("nodes", nodes)
            .set("edges", edges);
    }

    /**
     * 最短路径检索：BFS（边视为双向）查找 from 到 to 的最短路径
     */
    @GetMapping("/path")
    public ResponseEntity<JSONObject> path(@RequestParam String from,
                                           @RequestParam String to) {
        List<AgentGraphEdge> allEdges = edgeService.list();

        Map<String, List<String>> adjacency = new HashMap<>();
        for (AgentGraphEdge e : allEdges) {
            adjacency.computeIfAbsent(e.getSourceKey(), k -> new ArrayList<>()).add(e.getTargetKey());
            adjacency.computeIfAbsent(e.getTargetKey(), k -> new ArrayList<>()).add(e.getSourceKey());
        }

        LinkedList<String> queue = new LinkedList<>();
        HashSet<String> visited = new HashSet<>();
        HashMap<String, String> predecessors = new HashMap<>();

        queue.add(from);
        visited.add(from);
        predecessors.put(from, null);

        boolean found = false;
        while (!queue.isEmpty()) {
            String current = queue.poll();
            if (current.equals(to)) {
                found = true;
                break;
            }
            List<String> neighbors = adjacency.get(current);
            if (neighbors != null) {
                for (String next : neighbors) {
                    if (!visited.contains(next)) {
                        visited.add(next);
                        predecessors.put(next, current);
                        queue.add(next);
                    }
                }
            }
        }

        if (!found) {
            log.debug("No path found from {} to {}", from, to);
            return ResponseEntity.ok(new JSONObject()
                .set("path", Collections.emptyList())
                .set("nodes", Collections.emptyList()));
        }

        List<String> pathKeys = new ArrayList<>();
        String cursor = to;
        while (cursor != null) {
            pathKeys.add(cursor);
            cursor = predecessors.get(cursor);
        }
        Collections.reverse(pathKeys);

        List<AgentGraphNode> nodes = nodeService.list(
            new QueryWrapper<AgentGraphNode>().in("node_key", pathKeys));

        log.debug("Path found from {} to {}: length={}", from, to, pathKeys.size());
        return ResponseEntity.ok(new JSONObject()
            .set("path", pathKeys)
            .set("nodes", nodes));
    }
}
