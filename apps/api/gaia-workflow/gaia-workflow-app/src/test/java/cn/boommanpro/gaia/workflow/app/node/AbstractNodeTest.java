package cn.boommanpro.gaia.workflow.app.node;

import cn.boommanpro.gaia.workflow.base.GaiaWorkflow;
import cn.boommanpro.gaia.workflow.base.node.ChainParser;
import cn.boommanpro.gaia.workflow.base.node.NodeParser;
import cn.boommanpro.gaia.workflow.infra.extend.node.ChainParserManager;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import org.junit.jupiter.api.BeforeAll;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * 节点测试基类。
 * <p>
 * 提供两个能力：
 * <ol>
 *   <li>在纯单测环境（无 Spring 容器）下手动注册全部节点解析器</li>
 *   <li>从 classpath 加载节点 / 工作流 JSON fixture</li>
 * </ol>
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 */
public abstract class AbstractNodeTest {

    /**
     * 节点解析器是否已注册（{@link ChainParser#registerNodeParser} 写入静态 map，JVM 内只需一次）。
     */
    private static volatile boolean parsersRegistered = false;

    @BeforeAll
    static void registerParsers() {
        if (!parsersRegistered) {
            new ChainParserManager().initParserMap();
            parsersRegistered = true;
        }
    }

    /**
     * 加载 classpath 下 /nodes/xxx.json 为节点 JSONObject。
     */
    protected static JSONObject loadNodeJson(String name) {
        return JSONUtil.parseObj(readResource("/nodes/" + name + ".json"));
    }

    /**
     * 加载 classpath 下 /workflows/xxx.json 为完整工作流 JSON 字符串。
     */
    protected static String loadWorkflowJson(String name) {
        return readResource("/workflows/" + name + ".json");
    }

    /**
     * 加载 classpath 下任意资源为字符串。
     */
    protected static String readResource(String classpath) {
        try (InputStream is = AbstractNodeTest.class.getResourceAsStream(classpath)) {
            if (is == null) {
                throw new IllegalStateException("测试资源不存在: " + classpath);
            }
            java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
            byte[] data = new byte[4096];
            int n;
            while ((n = is.read(data)) != -1) {
                buffer.write(data, 0, n);
            }
            return new String(buffer.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("加载测试资源失败: " + classpath, e);
        }
    }

    /**
     * 用指定类型的解析器解析节点 JSON。
     */
    protected static cn.boommanpro.gaia.workflow.base.model.ChainNode parse(String nodeType, String fixtureName) {
        NodeParser parser = new ChainParser().getNodeParserMap().get(nodeType);
        if (parser == null) {
            throw new IllegalStateException("未注册节点解析器: " + nodeType);
        }
        JSONObject nodeJson = loadNodeJson(fixtureName);
        GaiaWorkflow workflow = new GaiaWorkflow("{}");
        return parser.parse(nodeJson, workflow);
    }
}
