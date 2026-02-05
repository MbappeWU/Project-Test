# MemoMind - 多模态个人记忆智能体

<p align="center">
  <strong>🧠 一个具有长短期记忆的本地化多模态AI助手</strong>
</p>

<p align="center">
  <a href="#特性">特性</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#使用指南">使用指南</a> •
  <a href="#配置">配置</a> •
  <a href="#架构">架构</a>
</p>

---

## 特性

- **🔒 隐私优先** - 所有数据本地存储，不上传云端
- **🎯 多模态理解** - 支持文本、图像、音频等多种数据类型
- **🧠 记忆系统** - 长短期记忆分层管理，智能检索与遗忘
- **📚 知识库** - 构建个人知识库，支持语义搜索
- **💬 智能问答** - 基于知识库和记忆的增强问答 (RAG)
- **🔌 多LLM支持** - 支持 Anthropic Claude、OpenAI、Ollama 本地模型

## 快速开始

### 环境要求

- Python 3.11+
- pip 或 uv

### 安装

```bash
# 克隆仓库
git clone https://github.com/MbappeWU/Project-Test.git
cd Project-Test

# 创建虚拟环境 (推荐)
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate  # Windows

# 安装依赖
pip install -e .

# 或使用 uv (更快)
uv pip install -e .
```

### 配置 API Key

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入你的 API Key
# ANTHROPIC_API_KEY=sk-ant-xxxxx
# 或 OPENAI_API_KEY=sk-xxxxx
```

或使用命令行配置：

```bash
# 初始化配置
memomind config init

# 设置 API Key (会安全存储)
export ANTHROPIC_API_KEY=your-key-here
```

### OAuth 登录 (推荐)

MemoMind 支持通过 OAuth 授权登录 Anthropic 和 OpenAI 账号，无需手动管理 API Key：

```bash
# 使用 Anthropic 账号登录
memomind auth login --provider anthropic

# 使用 OpenAI 账号登录
memomind auth login --provider openai

# 查看认证状态
memomind auth status

# 退出登录
memomind auth logout --provider anthropic
```

OAuth 登录会自动打开浏览器进行授权，令牌会安全存储在本地。

### 验证安装

```bash
# 检查版本
memomind version

# 测试连接
memomind chat
# 输入: /quit 退出
```

## 使用指南

### 交互式对话

```bash
# 启动对话模式
memomind chat
```

在对话模式中：
- 直接输入文字进行对话
- 输入 `/quit` 或 `/exit` 退出
- 输入 `/clear` 清除当前会话
- 输入 `/save` 保存当前会话

### 知识库管理

```bash
# 添加文件到知识库
memomind add document.txt
memomind add document.pdf
memomind add image.png          # 使用 Vision LLM 生成描述
memomind add audio.mp3          # 使用 Whisper 转录

# 添加整个目录
memomind add ./documents/

# 快速添加笔记
memomind note "今天学到了 Python 装饰器的用法"
memomind note "重要：明天下午3点开会" --tags "提醒,工作"

# 搜索知识库
memomind search "Python 装饰器"

# 列出所有文档
memomind list
memomind list --limit 20
```

### 记忆管理

```bash
# 查看记忆
memomind memory list
memomind memory list --type semantic

# 查看统计
memomind memory stats

# 清除短期记忆
memomind memory clear
```

### 配置管理

```bash
# 查看当前配置
memomind config show

# 初始化配置文件
memomind config init
```

## 配置

配置文件位于 `~/.memomind/config.yaml`：

```yaml
llm:
  provider: anthropic          # anthropic, openai, ollama
  model: claude-sonnet-4-20250514
  temperature: 0.7
  max_tokens: 4096

embeddings:
  provider: local              # local, openai
  model: all-MiniLM-L6-v2

memory:
  short_term_max_messages: 20
  retrieval_top_k: 5
  importance_threshold: 0.6

knowledge:
  chunk_size: 500
  chunk_overlap: 50
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API 密钥 |
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `MEMOMIND_LLM_PROVIDER` | LLM 提供商 (anthropic/openai/ollama) |
| `MEMOMIND_DATA_DIR` | 数据存储目录 (默认: ~/.memomind) |

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                      CLI Interface                       │
├─────────────────────────────────────────────────────────┤
│                   Agent Orchestrator                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │   Planner   │ │  Executor   │ │  Reflector  │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
├─────────────────────────────────────────────────────────┤
│                    Memory System                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ Short-term  │ │  Long-term  │ │   Working   │       │
│  │  (Session)  │ │ (VectorDB)  │ │  (Context)  │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
├─────────────────────────────────────────────────────────┤
│                  Knowledge Layer                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │    Text     │ │   Image     │ │    Audio    │       │
│  │  Processor  │ │  (Vision)   │ │  (Whisper)  │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
├─────────────────────────────────────────────────────────┤
│                   Infrastructure                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ LLM Client  │ │  ChromaDB   │ │ File Store  │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
└─────────────────────────────────────────────────────────┘
```

详细架构说明请参考 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 开发

### 安装开发依赖

```bash
pip install -e ".[dev]"
```

### 运行测试

```bash
# 运行所有测试
pytest

# 运行并显示覆盖率
pytest --cov=memomind --cov-report=html

# 运行特定测试
pytest tests/test_models.py -v
```

### 代码检查

```bash
# 格式化代码
black src/memomind tests

# 类型检查
mypy src/memomind

# Lint
ruff check src/memomind
```

## 可选功能

### 音频处理 (Whisper)

```bash
# 安装音频处理依赖
pip install -e ".[audio]"

# 现在可以处理音频文件
memomind add recording.mp3
```

## 常见问题

### Q: 如何使用本地模型？

配置 Ollama 作为 LLM 提供商：

```bash
# 确保 Ollama 正在运行
ollama serve

# 拉取模型
ollama pull llama2

# 配置 MemoMind
export MEMOMIND_LLM_PROVIDER=ollama
```

### Q: 数据存储在哪里？

所有数据存储在 `~/.memomind/` 目录：
- `config.yaml` - 配置文件
- `data/chroma/` - 向量数据库
- `data/sessions/` - 会话历史
- `data/documents/` - 原始文件

### Q: 如何备份数据？

```bash
# 备份整个数据目录
cp -r ~/.memomind ~/memomind-backup

# 或导出记忆
memomind memory export > memories.json
```

## 路线图

- [x] 基础对话功能
- [x] 知识库管理
- [x] 长短期记忆
- [x] 多模态支持 (文本/图像/音频)
- [ ] Web UI
- [ ] 知识图谱可视化
- [ ] 浏览器插件
- [ ] 移动端同步

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

<p align="center">
  Made with ❤️ by MemoMind Team
</p>
