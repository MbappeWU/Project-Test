# 多模态智能体项目规范 (Specification)

> **项目名称**: MemoMind - 多模态个人记忆智能体
> **版本**: v0.1.0 (MVP)
> **创建日期**: 2026-02-05
> **状态**: Draft

---

## 1. 项目概述

### 1.1 愿景

构建一个本地化部署的个人智能体，能够收集和理解多模态数据（文本、图像、音频），形成持久化的个人知识库与长短期记忆系统，支持智能问答和知识检索。

### 1.2 核心价值

- **隐私优先**: 所有数据本地存储，不上传云端
- **多模态理解**: 支持文本、图像、音频等多种数据类型
- **记忆持久化**: 长短期记忆分层管理，智能遗忘与强化
- **个性化**: 随使用积累，形成个人专属知识库

### 1.3 目标用户

个人用户，用于：
- 个人知识管理
- 学习笔记整理
- 信息检索与问答
- 记忆辅助与增强

---

## 2. 功能需求 (Functional Requirements)

### 2.1 MVP 功能范围

#### F1: 知识库管理

| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F1.1 | 文本导入 | P0 | 支持导入 txt, md, pdf 文本文件 |
| F1.2 | 图像导入 | P0 | 支持导入 jpg, png 图像，提取描述 |
| F1.3 | 音频导入 | P1 | 支持导入 mp3, wav，转写为文本 |
| F1.4 | 手动笔记 | P0 | 支持用户直接输入笔记 |
| F1.5 | 知识浏览 | P0 | 查看、搜索已存储的知识条目 |
| F1.6 | 知识删除 | P1 | 删除指定知识条目 |

#### F2: 记忆系统

| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F2.1 | 短期记忆 | P0 | 维护当前会话上下文 (最近N轮对话) |
| F2.2 | 长期记忆存储 | P0 | 将重要信息持久化到向量数据库 |
| F2.3 | 记忆检索 | P0 | 基于语义相似度检索相关记忆 |
| F2.4 | 记忆整合 | P1 | 定期整合相似记忆，提取核心概念 |
| F2.5 | 时间衰减 | P2 | 记忆重要性随时间衰减 |

#### F3: 智能问答

| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F3.1 | 基础对话 | P0 | 与智能体进行自然语言对话 |
| F3.2 | 知识增强问答 | P0 | 基于知识库内容回答问题 (RAG) |
| F3.3 | 记忆感知回答 | P0 | 回答时参考历史对话和记忆 |
| F3.4 | 来源引用 | P1 | 回答时标注信息来源 |

### 2.2 未来功能 (Post-MVP)

- 知识图谱构建与可视化
- 多模态融合理解
- 主动学习与提问
- 日程与任务管理集成
- 浏览器插件 (网页收藏)
- 移动端同步

---

## 3. 非功能需求 (Non-Functional Requirements)

### 3.1 性能要求

| 指标 | 要求 |
|------|------|
| 问答响应时间 | < 5秒 (不含LLM API延迟) |
| 知识检索时间 | < 1秒 (10万条记录内) |
| 文件导入速度 | 文本 < 2秒/MB, 图像 < 5秒/张 |
| 内存占用 | < 2GB (空闲状态) |

### 3.2 安全与隐私

- 所有数据存储在本地文件系统
- API Key 加密存储
- 不收集任何用户数据
- 支持数据导出和完全删除

### 3.3 可用性

- 命令行界面 (CLI) - MVP
- Web界面 (可选) - Post-MVP
- 支持 macOS, Linux, Windows

### 3.4 可扩展性

- 模块化设计，支持插件扩展
- 支持多种 LLM 后端切换
- 支持多种向量数据库切换

---

## 4. 系统架构

### 4.1 高层架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户界面层 (UI Layer)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    CLI      │  │  Web UI     │  │   API       │             │
│  │  (MVP)      │  │  (Future)   │  │  (Future)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      智能体核心层 (Agent Core)                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Agent Orchestrator                     │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐             │   │
│  │  │ Planner   │ │ Executor  │ │ Reflector │             │   │
│  │  └───────────┘ └───────────┘ └───────────┘             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      记忆系统层 (Memory Layer)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 短期记忆    │  │ 长期记忆    │  │ 工作记忆    │             │
│  │ (Session)   │  │ (Vector DB) │  │ (Context)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      知识处理层 (Knowledge Layer)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 文本处理    │  │ 图像处理    │  │ 音频处理    │             │
│  │ (Chunking)  │  │ (Vision)    │  │ (ASR)       │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      基础设施层 (Infrastructure)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ LLM Client  │  │ Vector DB   │  │ File Store  │             │
│  │ (API/OAuth) │  │ (ChromaDB)  │  │ (Local FS)  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 核心组件

#### 4.2.1 Agent Orchestrator (智能体编排器)

负责协调各组件，处理用户请求的完整生命周期。

```python
class AgentOrchestrator:
    """
    职责:
    - 接收用户输入
    - 协调记忆检索
    - 调用LLM生成回复
    - 更新记忆系统
    """
    def process(self, user_input: str) -> AgentResponse:
        pass
```

#### 4.2.2 Memory Manager (记忆管理器)

管理长短期记忆的存储、检索和整合。

```python
class MemoryManager:
    """
    职责:
    - 短期记忆: 维护会话历史 (最近k轮)
    - 长期记忆: 向量数据库存储与检索
    - 工作记忆: 当前任务相关上下文
    """
    def add_memory(self, content: str, metadata: dict) -> str:
        pass

    def retrieve(self, query: str, top_k: int = 5) -> List[Memory]:
        pass

    def get_session_context(self) -> List[Message]:
        pass
```

#### 4.2.3 Knowledge Processor (知识处理器)

处理多模态数据的导入和转换。

```python
class KnowledgeProcessor:
    """
    职责:
    - 文本: 分块、提取关键信息
    - 图像: 生成描述、OCR
    - 音频: 语音转文字
    """
    def process_text(self, file_path: str) -> List[Document]:
        pass

    def process_image(self, file_path: str) -> Document:
        pass

    def process_audio(self, file_path: str) -> Document:
        pass
```

#### 4.2.4 LLM Client (大模型客户端)

统一的LLM调用接口，支持多种后端。

```python
class LLMClient:
    """
    支持的后端:
    - Anthropic Claude API
    - OpenAI API
    - 本地模型 (Ollama)
    """
    def chat(self, messages: List[Message]) -> str:
        pass

    def embed(self, text: str) -> List[float]:
        pass
```

### 4.3 数据流

```
用户输入
    │
    ▼
┌─────────────────┐
│ 1. 解析输入     │ ← 判断意图 (问答/导入/管理)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. 检索记忆     │ ← 从长期记忆检索相关内容
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. 构建上下文   │ ← 合并: 系统提示 + 短期记忆 + 检索结果 + 用户输入
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. LLM 推理     │ ← 调用大模型生成回复
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. 更新记忆     │ ← 将对话存入短期记忆，重要信息存入长期记忆
└────────┬────────┘
         │
         ▼
    输出回复
```

---

## 5. 数据模型

### 5.1 核心实体

```python
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
from enum import Enum

class ModalityType(Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"

class MemoryType(Enum):
    EPISODIC = "episodic"    # 情景记忆 (具体事件)
    SEMANTIC = "semantic"     # 语义记忆 (知识概念)
    PROCEDURAL = "procedural" # 程序记忆 (操作偏好)

@dataclass
class Document:
    """知识库文档"""
    id: str
    content: str                    # 文本内容
    modality: ModalityType          # 模态类型
    source_path: Optional[str]      # 原始文件路径
    metadata: dict                  # 元数据 (标题、标签等)
    embedding: Optional[List[float]] # 向量表示
    created_at: datetime
    updated_at: datetime

@dataclass
class Memory:
    """记忆条目"""
    id: str
    content: str                    # 记忆内容
    memory_type: MemoryType         # 记忆类型
    importance: float               # 重要性分数 [0, 1]
    access_count: int               # 访问次数
    last_accessed: datetime         # 最后访问时间
    source_doc_id: Optional[str]    # 来源文档ID
    embedding: List[float]          # 向量表示
    created_at: datetime

@dataclass
class Message:
    """对话消息"""
    role: str                       # "user" | "assistant" | "system"
    content: str
    timestamp: datetime
    metadata: Optional[dict] = None

@dataclass
class Session:
    """会话"""
    id: str
    messages: List[Message]         # 对话历史
    created_at: datetime
    updated_at: datetime
```

### 5.2 存储结构

```
~/.memomind/
├── config.yaml              # 配置文件
├── data/
│   ├── documents/           # 原始文件存储
│   │   ├── text/
│   │   ├── images/
│   │   └── audio/
│   ├── chroma/              # 向量数据库
│   └── sessions/            # 会话历史 (JSON)
└── logs/                    # 日志文件
```

---

## 6. 接口设计

### 6.1 CLI 命令

```bash
# 启动交互式对话
memomind chat

# 知识库管理
memomind add <file_or_directory>    # 添加文件到知识库
memomind add --note "内容"           # 添加笔记
memomind list                        # 列出知识库条目
memomind search <query>              # 搜索知识库
memomind delete <doc_id>             # 删除条目

# 记忆管理
memomind memory list                 # 查看记忆
memomind memory clear                # 清除短期记忆
memomind memory export               # 导出记忆

# 配置
memomind config set llm.provider anthropic
memomind config set llm.api_key <key>
memomind config show
```

### 6.2 内部 API

```python
class MemoMindAPI:
    # 对话
    def chat(self, message: str) -> str: ...

    # 知识库
    def add_document(self, file_path: str) -> Document: ...
    def add_note(self, content: str, tags: List[str] = None) -> Document: ...
    def search_documents(self, query: str, limit: int = 10) -> List[Document]: ...
    def delete_document(self, doc_id: str) -> bool: ...

    # 记忆
    def get_memories(self, query: str = None, limit: int = 10) -> List[Memory]: ...
    def clear_session(self) -> None: ...
```

---

## 7. 技术选型

### 7.1 技术栈

| 层级 | 技术选择 | 理由 |
|------|----------|------|
| 编程语言 | Python 3.11+ | 生态丰富，AI/ML库完善 |
| CLI框架 | Typer + Rich | 现代CLI体验，美观输出 |
| 向量数据库 | ChromaDB | 轻量级，本地部署，无需服务 |
| 嵌入模型 | sentence-transformers | 本地运行，隐私保护 |
| LLM客户端 | LiteLLM | 统一接口，支持多后端 |
| 配置管理 | Pydantic + YAML | 类型安全，易读配置 |
| 文本处理 | LangChain (部分) | 成熟的文档分块方案 |
| 图像理解 | LLM Vision API | 利用多模态LLM能力 |
| 音频转写 | Whisper (本地) | OpenAI开源，本地运行 |

### 7.2 依赖清单

```toml
[project]
name = "memomind"
version = "0.1.0"
requires-python = ">=3.11"

[project.dependencies]
# Core
typer = "^0.9.0"
rich = "^13.0.0"
pydantic = "^2.0.0"
pyyaml = "^6.0"

# LLM & Embeddings
litellm = "^1.0.0"
sentence-transformers = "^2.2.0"

# Vector Database
chromadb = "^0.4.0"

# Document Processing
pypdf = "^3.0.0"
python-docx = "^1.0.0"
pillow = "^10.0.0"

# Audio (optional)
openai-whisper = "^20231117"

# Utilities
python-dotenv = "^1.0.0"
```

---

## 8. 项目结构

```
memomind/
├── pyproject.toml
├── README.md
├── LICENSE
├── .env.example
│
├── src/
│   └── memomind/
│       ├── __init__.py
│       ├── __main__.py          # CLI入口
│       │
│       ├── cli/                 # CLI命令
│       │   ├── __init__.py
│       │   ├── main.py
│       │   ├── chat.py
│       │   ├── knowledge.py
│       │   └── config.py
│       │
│       ├── core/                # 核心逻辑
│       │   ├── __init__.py
│       │   ├── agent.py         # Agent Orchestrator
│       │   ├── memory.py        # Memory Manager
│       │   └── knowledge.py     # Knowledge Processor
│       │
│       ├── llm/                 # LLM集成
│       │   ├── __init__.py
│       │   ├── client.py        # LLM Client
│       │   └── embeddings.py    # Embedding Model
│       │
│       ├── storage/             # 存储层
│       │   ├── __init__.py
│       │   ├── vector_store.py  # ChromaDB封装
│       │   └── file_store.py    # 文件存储
│       │
│       ├── processors/          # 数据处理器
│       │   ├── __init__.py
│       │   ├── text.py
│       │   ├── image.py
│       │   └── audio.py
│       │
│       ├── models/              # 数据模型
│       │   ├── __init__.py
│       │   ├── document.py
│       │   ├── memory.py
│       │   └── message.py
│       │
│       ├── config/              # 配置管理
│       │   ├── __init__.py
│       │   └── settings.py
│       │
│       └── utils/               # 工具函数
│           ├── __init__.py
│           └── helpers.py
│
├── tests/                       # 测试
│   ├── __init__.py
│   ├── test_agent.py
│   ├── test_memory.py
│   └── test_knowledge.py
│
└── docs/                        # 文档
    ├── SPEC.md                  # 本文档
    └── ARCHITECTURE.md          # 架构详解
```

---

## 9. 实现计划

### Phase 1: 基础框架 (Week 1)

- [ ] 项目初始化 (pyproject.toml, 目录结构)
- [ ] 配置管理模块
- [ ] LLM Client 封装
- [ ] CLI 基础框架

### Phase 2: 知识库 (Week 2)

- [ ] 向量数据库集成 (ChromaDB)
- [ ] 文本处理器 (分块、嵌入)
- [ ] 知识库 CRUD 操作
- [ ] CLI 知识库命令

### Phase 3: 记忆系统 (Week 3)

- [ ] 短期记忆 (会话管理)
- [ ] 长期记忆 (向量存储)
- [ ] 记忆检索与排序
- [ ] 记忆整合机制

### Phase 4: 智能问答 (Week 4)

- [ ] RAG 流程实现
- [ ] 上下文构建
- [ ] 对话循环
- [ ] 来源引用

### Phase 5: 多模态扩展 (Week 5-6)

- [ ] 图像处理器
- [ ] 音频处理器 (Whisper)
- [ ] 多模态文档支持

### Phase 6: 优化与测试 (Week 7)

- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能优化
- [ ] 文档完善

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM API 成本 | 高使用成本 | 支持本地模型(Ollama)，缓存机制 |
| 向量检索精度 | 回答质量差 | 混合检索(语义+关键词)，重排序 |
| 大文件处理 | 内存溢出 | 流式处理，分块导入 |
| 隐私泄露 | 用户信任 | 代码审计，无网络传输(除LLM API) |

---

## 11. 成功指标

### MVP 完成标准

- [ ] 可通过 CLI 进行对话
- [ ] 可导入文本文件建立知识库
- [ ] 问答时能检索相关知识
- [ ] 能记住同一会话内的对话
- [ ] 能跨会话记住重要信息

### 质量标准

- 测试覆盖率 > 70%
- 无严重安全漏洞
- 文档完整

---

## 12. 附录

### A. 术语表

| 术语 | 定义 |
|------|------|
| RAG | Retrieval-Augmented Generation，检索增强生成 |
| Embedding | 将文本转换为向量表示 |
| Chunking | 将长文本分割为小块 |
| Vector Store | 向量数据库，用于存储和检索向量 |

### B. 参考资料

- [LangChain Documentation](https://python.langchain.com/)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [LiteLLM Documentation](https://docs.litellm.ai/)
- [Cognitive Architecture for Language Agents](https://arxiv.org/abs/2309.02427)

---

*文档版本: v0.1.0 | 最后更新: 2026-02-05*
