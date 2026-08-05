package cn.boommanpro.gaia.workflow.app.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Arrays;
import java.util.List;

/**
 * 启动时幂等补充 SQLite 已有表的列（SQLite 不支持 ADD COLUMN IF NOT EXISTS）
 */
@Slf4j
@Component
public class SchemaMigrationInitializer implements CommandLineRunner {

    // column: table, column name, column type
    private static final List<String[]> MIGRATIONS = Arrays.asList(
        new String[]{"agent_message", "images", "TEXT"},
        new String[]{"agent_message", "parent_message_id", "VARCHAR(64)"}
    );

    private final DataSource dataSource;

    public SchemaMigrationInitializer(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(String... args) {
        try (Connection conn = dataSource.getConnection()) {
            for (String[] migration : MIGRATIONS) {
                String table = migration[0];
                String column = migration[1];
                String type = migration[2];
                if (!columnExists(conn, table, column)) {
                    String sql = "ALTER TABLE " + table + " ADD COLUMN " + column + " " + type;
                    try (Statement stmt = conn.createStatement()) {
                        stmt.execute(sql);
                        log.info("Schema migration: added column {}.{} ({})", table, column, type);
                    } catch (Exception e) {
                        log.warn("Schema migration failed for {}.{}: {}", table, column, e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Schema migration initializer failed: {}", e.getMessage());
        }
    }

    private boolean columnExists(Connection conn, String table, String column) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("PRAGMA table_info(" + table + ")")) {
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    if (column.equalsIgnoreCase(rs.getString("name"))) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
