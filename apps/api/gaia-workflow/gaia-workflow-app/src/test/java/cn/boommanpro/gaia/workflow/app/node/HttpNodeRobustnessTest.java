package cn.boommanpro.gaia.workflow.app.node;

import cn.boommanpro.gaia.workflow.app.domain.testrun.input.SingleNodeRunInput;
import cn.boommanpro.gaia.workflow.app.domain.testrun.output.SingleNodeRunOutput;
import cn.boommanpro.gaia.workflow.app.executor.SingleNodeExecutor;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * HTTP 节点稳健性测试。
 * <p>
 * 验证两个已知问题：
 * <ol>
 *   <li>timeout.retryTimes 已解析但 execute 从不重试 → 请求次数应等于 retryTimes</li>
 *   <li>data 缺失 api 配置时不应裸 NPE，应优雅降级到 result.error</li>
 * </ol>
 *
 * @author <a href="mailto:boommanpro@gmail.com">boommanpro</a>
 */
@DisplayName("HTTP 节点稳健性测试")
class HttpNodeRobustnessTest extends AbstractNodeTest {

    private final SingleNodeExecutor executor = new SingleNodeExecutor();

    @Test
    @DisplayName("retryTimes 应生效：失败后重试，共发起 retryTimes 次请求")
    void retryTimesShouldBeHonored() throws Exception {
        int retryTimes = 3;

        // 起一个本地 HTTP 服务：前 (retryTimes-1) 次连接建立后立即断开（触发重试），最后一次正常返回 200
        try (ServerSocket server = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))) {
            AtomicInteger hits = new AtomicInteger();
            CountDownLatch latch = new CountDownLatch(retryTimes);
            Thread serverThread = new Thread(() -> {
                try {
                    for (int i = 0; i < retryTimes; i++) {
                        try (Socket socket = server.accept()) {
                            hits.incrementAndGet();
                            // 丢弃请求头直到空行
                            InputStream in = socket.getInputStream();
                            BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
                            String line;
                            while ((line = reader.readLine()) != null && !line.isEmpty()) {
                                // 丢弃请求头
                            }
                            // 最后一次返回正常响应，其余直接关闭连接以触发客户端异常
                            if (i == retryTimes - 1) {
                                String resp = "HTTP/1.1 200 OK\r\nContent-Length: 4\r\nContent-Type: text/plain\r\n\r\nbody";
                                OutputStream out = socket.getOutputStream();
                                out.write(resp.getBytes(StandardCharsets.UTF_8));
                                out.flush();
                            }
                        }
                        latch.countDown();
                    }
                } catch (Exception e) {
                    // 连接关闭等，忽略
                }
            });
            serverThread.setDaemon(true);
            serverThread.start();

            SingleNodeRunOutput out = runHttp("http://127.0.0.1:" + server.getLocalPort() + "/ping", retryTimes);
            assertTrue(out.isSuccess(), "最终一次应成功, error=" + out.getError());
            assertNull(out.getExecuteResult().get("error"), "不应残留 error, result=" + out.getExecuteResult());

            // 稍等接收所有请求，修复前只有 1 次，修复后应为 retryTimes 次
            latch.await(5, TimeUnit.SECONDS);
            assertEquals(retryTimes, hits.get(),
                    "期望发起 " + retryTimes + " 次请求，实际 " + hits.get());
        }
    }

    @Test
    @DisplayName("api 配置缺失时应优雅降级，而非抛出 NPE")
    void missingApiShouldDegradeGracefully() {
        SingleNodeRunInput input = new SingleNodeRunInput();
        input.setNode(httpNodeWithApi(false).toString());
        input.setInputs(null);

        SingleNodeRunOutput out = executor.execute(input);
        assertTrue(out.isSuccess(), "api 缺失不应导致节点失败, error=" + out.getError());
        assertNotNull(out.getExecuteResult());
        // 降级语义：result 中包含 error 说明，而非逻辑结果
        assertNotNull(out.getExecuteResult().get("error"),
                "api 缺失时应输出 error 字段，实际结果=" + out.getExecuteResult());
    }

    // ==================== 辅助 ====================

    private SingleNodeRunOutput runHttp(String url, int retryTimes) {
        SingleNodeRunInput input = new SingleNodeRunInput();
        input.setNode(httpNodeJson(url, retryTimes).toString());
        input.setInputs(null);
        return executor.execute(input);
    }

    /** 构造一个指向指定 URL、带 retryTimes 的 http 节点 JSON */
    private static JSONObject httpNodeJson(String url, int retryTimes) {
        return JSONUtil.createObj()
                .set("id", "http_0")
                .set("type", "http")
                .set("data", JSONUtil.createObj()
                        .set("title", "HTTP请求")
                        .set("api", JSONUtil.createObj()
                                .set("method", "GET")
                                .set("url", JSONUtil.createObj()
                                        .set("type", "constant")
                                        .set("content", url)))
                        .set("headersValues", JSONUtil.createObj())
                        .set("paramsValues", JSONUtil.createObj())
                        .set("body", JSONUtil.createObj().set("bodyType", "none"))
                        .set("timeout", JSONUtil.createObj()
                                .set("timeout", 3000)
                                .set("retryTimes", retryTimes))
                        .set("outputs", httpOutputsSchema()));
    }

    /** 构造一个缺失 api 的 http 节点 JSON */
    private static JSONObject httpNodeWithApi(boolean includeApi) {
        JSONObject data = JSONUtil.createObj()
                .set("title", "HTTP请求")
                .set("headersValues", JSONUtil.createObj())
                .set("paramsValues", JSONUtil.createObj())
                .set("body", JSONUtil.createObj().set("bodyType", "none"))
                .set("timeout", JSONUtil.createObj()
                        .set("timeout", 3000)
                        .set("retryTimes", 1))
                .set("outputs", httpOutputsSchema());
        if (includeApi) {
            data.set("api", JSONUtil.createObj()
                    .set("method", "GET")
                    .set("url", JSONUtil.createObj()
                            .set("type", "constant")
                            .set("content", "http://127.0.0.1:1/ping")));
        }
        return JSONUtil.createObj().set("id", "http_0").set("type", "http").set("data", data);
    }

    private static JSONObject httpOutputsSchema() {
        return JSONUtil.createObj()
                .set("type", "object")
                .set("properties", JSONUtil.createObj()
                        .set("body", JSONUtil.createObj().set("type", "string"))
                        .set("headers", JSONUtil.createObj().set("type", "object"))
                        .set("statusCode", JSONUtil.createObj().set("type", "number")));
    }
}