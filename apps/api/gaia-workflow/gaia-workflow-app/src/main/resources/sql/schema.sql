CREATE TABLE IF NOT EXISTS gaia_workflow_template (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_code VARCHAR(64) NOT NULL UNIQUE,
    template_name VARCHAR(128) NOT NULL,
    template_desc TEXT,
    template_data TEXT,
    created_at TEXT,
    updated_at TEXT,
    is_deleted TINYINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gaia_workflow (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_code VARCHAR(64) NOT NULL UNIQUE,
    workflow_name VARCHAR(128) NOT NULL,
    workflow_desc TEXT,
    current_version_id INTEGER,
    template_code VARCHAR(64),
    created_at TEXT,
    updated_at TEXT,
    is_deleted TINYINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gaia_workflow_version (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_code VARCHAR(64) NOT NULL,
    version_number VARCHAR(32) NOT NULL,
    version_desc VARCHAR(256),
    workflow_data TEXT,
    created_by VARCHAR(64),
    created_at TEXT,
    is_current TINYINT DEFAULT 0,
    UNIQUE(workflow_code, version_number)
);

CREATE TABLE IF NOT EXISTS gaia_workflow_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_code VARCHAR(64) NOT NULL,
    version_number VARCHAR(32) NOT NULL,
    execution_id VARCHAR(64) NOT NULL UNIQUE,
    start_time TEXT,
    end_time TEXT,
    status VARCHAR(32),
    input_params TEXT,
    output_params TEXT,
    error_message TEXT,
    execution_duration BIGINT,
    created_at TEXT
);

-- Agent 对话会话表（多会话管理）
CREATE TABLE IF NOT EXISTS agent_session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(128),
    created_at TEXT,
    updated_at TEXT,
    is_deleted TINYINT DEFAULT 0
);

-- Agent 对话消息表（持久化历史对话）
CREATE TABLE IF NOT EXISTS agent_message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key VARCHAR(64) NOT NULL,
    role VARCHAR(16) NOT NULL,
    content TEXT,
    tool_calls TEXT,
    tool_call_id VARCHAR(64),
    page_context TEXT,
    created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_message_session ON agent_message(session_key, id);

-- Agent 权限习惯表（per-action 可配置）
CREATE TABLE IF NOT EXISTS agent_permission (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    policy VARCHAR(16) NOT NULL DEFAULT 'confirm',
    UNIQUE(session_key, action)
);