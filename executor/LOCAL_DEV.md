# Executor 模块本地开发文档

## 概述

Executor 是 Wegent 项目的任务执行器模块，负责接收和处理任务请求。本模块基于 FastAPI 构建，提供 RESTful API 接口用于任务执行和管理。

## 项目结构

```
executor/
├── agents/              # Agent 实现
│   ├── agno/           # Agno Agent 实现
│   ├── claude_code/    # Claude Code Agent 实现
│   ├── base.py         # Agent 基类
│   └── factory.py      # Agent 工厂
├── callback/           # 回调处理
├── config/             # 配置管理
├── services/           # 业务服务层
├── tasks/              # 任务处理
├── utils/              # 工具函数
├── tests/              # 测试用例
├── main.py             # 应用入口
└── requirements.txt    # 依赖包列表
```

## 本地启动

> **⚠️ 重要提示**：
> 1. 所有操作都必须在 **项目根目录（Wegent/）** 进行，而不是 executor 子目录
> 2. 必须设置 `export PYTHONPATH=$(pwd)` 环境变量
> 3. 推荐使用 uv 的虚拟环境来隔离项目依赖

### 环境要求

- Python 3.8+
- uv (推荐的 Python 包管理工具)

### 安装 uv

如果你还没有安装 uv，可以通过以下命令安装：

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# 或使用 pip 安装
pip install uv
```

### 步骤 1: 创建虚拟环境

> **重要**：虚拟环境需要在 **项目根目录** 创建，而不是 executor 子目录。

使用 uv 创建并激活虚拟环境：

```bash
# 确保在项目根目录（Wegent/）
cd /path/to/Wegent

# 创建虚拟环境（基于项目 Python 版本）
uv venv

# 激活虚拟环境
# Linux/macOS:
source .venv/bin/activate

# Windows:
# .venv\Scripts\activate
```

### 步骤 2: 安装依赖

在虚拟环境中安装项目依赖：

```bash
# 确保在项目根目录
cd /path/to/Wegent

# 安装 executor 模块的依赖
uv pip install -r executor/requirements.txt
```

### 步骤 3: 配置环境变量

Executor 需要以下环境变量进行配置：

#### 必需环境变量

```bash
# Python 路径配置（必需！）
export PYTHONPATH=$(pwd)

# API 密钥配置
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export OPENAI_API_KEY="your-openai-api-key"  # 如果使用 OpenAI 模型

# 工作空间配置
export WORKSPACE_ROOT="/path/to/your/workspace"  # 默认: /workspace/

# 服务端口
export PORT=10001  # 默认: 10001
```

#### 可选环境变量

```bash
# 回调 URL（用于任务状态回调）
export CALLBACK_URL="http://your-callback-service/api/callback"

# 执行器标识（K8s 环境使用）
export EXECUTOR_NAME="local-executor"
export EXECUTOR_NAMESPACE="default"

# 调试模式
export DEBUG_RUN="true"

# 自定义配置（JSON 格式）
export EXECUTOR_ENV='{}'
```

#### 任务信息（可选，用于启动时自动执行任务）

```bash
# TASK_INFO 包含任务的详细信息
export TASK_INFO='{"task_id": 1, "subtask_id": 1, "agent_type": "claude_code", ...}'
```

### 步骤 4: 启动服务

> **注意**：启动服务必须在 **项目根目录** 执行，且已设置 PYTHONPATH。

在虚拟环境中使用 uv 运行服务：

```bash
# 确保在项目根目录（Wegent/）
cd /path/to/Wegent

# 确保虚拟环境已激活
# 如果没有激活，先运行: source .venv/bin/activate

# 设置 PYTHONPATH（必需！）
export PYTHONPATH=$(pwd)

# 方式 1: 直接使用 uv 运行
uv run python -m executor.main

# 方式 2: 使用 uvicorn 运行（更多控制选项，推荐用于开发）
uv run uvicorn executor.main:app --host 0.0.0.0 --port 10001 --reload

# 方式 3: 在已激活的虚拟环境中直接运行
python -m executor.main
# 或
uvicorn executor.main:app --host 0.0.0.0 --port 10001 --reload
```

#### 启动参数说明

- `--host 0.0.0.0`: 监听所有网络接口
- `--port 10001`: 指定服务端口（默认 10001）
- `--reload`: 开启热重载，代码修改后自动重启（仅开发环境使用）

### 步骤 5: 验证服务

服务启动后，可以通过以下方式验证：

```bash
# 检查服务健康状态
curl http://localhost:10001/docs

# 查看 API 文档
# 在浏览器中打开: http://localhost:10001/docs
```

## API 接口

Executor 提供以下主要 API 接口：

### 1. 执行任务

```bash
POST /api/tasks/execute
Content-Type: application/json

{
  "task_id": 1,
  "subtask_id": 1,
  "agent_type": "claude_code",
  "task_title": "任务标题",
  "subtask_title": "子任务标题",
  "content": "任务内容",
  "repo_url": "https://github.com/example/repo.git",
  "branch": "main",
  "git_username": "user",
  "git_password": "password"
}
```

### 2. 列出所有会话

```bash
GET /api/tasks/sessions
```

### 3. 删除指定会话

```bash
DELETE /api/tasks/session?task_id=1
```

### 4. 关闭所有 Claude 会话

```bash
DELETE /api/tasks/claude/sessions
```

### 5. 关闭所有 Agent 会话

```bash
DELETE /api/tasks/sessions/close
```

## 快速启动脚本示例

创建一个 `start.sh` 脚本用于快速启动：

```bash
#!/bin/bash

# 必须在项目根目录运行
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 设置 PYTHONPATH（必需！）
export PYTHONPATH=$(pwd)

# 设置其他环境变量
export ANTHROPIC_API_KEY="your-api-key"
export WORKSPACE_ROOT="./workspace"
export PORT=10001
export DEBUG_RUN="true"

# 创建工作空间目录
mkdir -p $WORKSPACE_ROOT

# 创建虚拟环境（如果不存在）
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    uv venv
fi

# 激活虚拟环境
echo "Activating virtual environment..."
source .venv/bin/activate

# 安装依赖（首次运行或更新依赖时）
echo "Installing dependencies..."
uv pip install -r executor/requirements.txt

# 启动服务
echo "Starting executor service..."
echo "PYTHONPATH is set to: $PYTHONPATH"
uv run uvicorn executor.main:app --host 0.0.0.0 --port $PORT --reload
```

使用方式：

```bash
# 在项目根目录创建脚本
cd /path/to/Wegent
chmod +x start.sh
./start.sh
```

## 开发调试

### 查看日志

Executor 使用结构化日志，日志会输出到控制台：

```bash
# 日志格式
2025-01-10 10:30:00 - task_executor - INFO - Starting task execution...
```

### 使用 IDE 调试

#### VS Code 配置

在 `.vscode/launch.json` 中添加配置：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Executor Debug",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": [
        "executor.main:app",
        "--host", "0.0.0.0",
        "--port", "10001",
        "--reload"
      ],
      "env": {
        "ANTHROPIC_API_KEY": "your-api-key",
        "WORKSPACE_ROOT": "./workspace",
        "DEBUG_RUN": "true"
      },
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    }
  ]
}
```

### 运行测试

在虚拟环境中运行测试：

```bash
# 确保虚拟环境已激活
source .venv/bin/activate

# 安装测试依赖
uv pip install pytest pytest-asyncio

# 运行所有测试
uv run pytest
# 或在激活的虚拟环境中
pytest

# 运行指定测试文件
uv run pytest tests/agents/test_factory.py

# 运行测试并显示详细输出
uv run pytest -v

# 运行测试并显示覆盖率
uv run pytest --cov=executor --cov-report=html
```

## 常见问题

### 1. 端口被占用

错误信息：`[Errno 48] Address already in use`

解决方法：
```bash
# 查找占用端口的进程
lsof -i :10001

# 杀掉占用端口的进程
kill -9 <PID>

# 或使用其他端口
export PORT=10002
```

### 2. API Key 未配置

错误信息：`API key not configured`

解决方法：
```bash
# 确保设置了正确的 API Key
export ANTHROPIC_API_KEY="your-actual-api-key"
```

### 3. 工作空间路径不存在

错误信息：`Workspace directory does not exist`

解决方法：
```bash
# 创建工作空间目录
mkdir -p /path/to/workspace
export WORKSPACE_ROOT="/path/to/workspace"
```

### 4. 虚拟环境未激活

错误信息：`ModuleNotFoundError: No module named 'xxx'`

解决方法：
```bash
# 激活虚拟环境（确保在项目根目录）
cd /path/to/Wegent
source .venv/bin/activate

# 确认虚拟环境已激活（命令行前会显示 (.venv)）
# 然后重新运行命令
```

### 5. PYTHONPATH 未设置

错误信息：`ModuleNotFoundError: No module named 'shared'` 或 `ModuleNotFoundError: No module named 'executor'`

解决方法：
```bash
# 必须在项目根目录设置 PYTHONPATH
cd /path/to/Wegent
export PYTHONPATH=$(pwd)

# 确认 PYTHONPATH 已设置
echo $PYTHONPATH

# 然后重新运行启动命令
```

### 6. 在错误的目录运行

错误信息：各种模块导入错误

解决方法：
```bash
# 确保在项目根目录（Wegent/）而不是 executor/ 子目录
cd /path/to/Wegent  # 正确
# 不要在 /path/to/Wegent/executor 目录运行

# 设置 PYTHONPATH
export PYTHONPATH=$(pwd)

# 然后运行启动命令
uv run uvicorn executor.main:app --host 0.0.0.0 --port 10001 --reload
```

### 7. uv 命令找不到

错误信息：`command not found: uv`

解决方法：
```bash
# 安装 uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 或使用 pip 安装
pip install uv

# 重新加载 shell 配置
source ~/.bashrc  # 或 source ~/.zshrc
```

## 下一步

- [Agent 开发指南](./AGENT_DEV.md)（待完成）
- [配置详解](./CONFIG.md)（待完成）
- [部署指南](./DEPLOYMENT.md)（待完成）
- [API 参考文档](./API.md)（待完成）

## 许可证

Apache License 2.0 - 详见项目根目录 LICENSE 文件
