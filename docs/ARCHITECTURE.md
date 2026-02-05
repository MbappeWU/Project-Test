# MemoMind 系统架构设计

> 版本: v0.1.0 | 更新日期: 2026-02-05

## 1. 架构概览

MemoMind 采用分层架构设计，确保各层职责清晰、松耦合、易扩展。

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Presentation Layer                            │
│                              (CLI/API)                                 │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Application Layer                             │
│                        (Agent Orchestrator)                            │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
┌──────────────────────┐ ┌──────────────┐ ┌──────────────────────┐
│    Memory Layer      │ │ Knowledge    │ │    LLM Layer         │
│ (Short/Long-term)    │ │ Layer        │ │ (Client/Embeddings)  │
└──────────┬───────────┘ └──────┬───────┘ └──────────┬───────────┘
           │                    │                     │
           └────────────────────┼─────────────────────┘
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Infrastructure Layer                           │
│              (Vector DB / File Store / Config)                         │
└────────────────────────────────────────────────────────────────────────┘
```

## 2. 核心组件详细设计

### 2.1 Agent Orchestrator (智能体编排器)

**职责**: 作为系统的中央协调者，处理用户请求的完整生命周期。

```
                         ┌─────────────────┐
                         │    User Input   │
                         └────────┬────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │     Agent Orchestrator      │
                    │  ┌───────────────────────┐  │
                    │  │    Intent Classifier  │  │ ← 判断: 对话/导入/查询/管理
                    │  └───────────┬───────────┘  │
                    │              │              │
                    │  ┌───────────▼───────────┐  │
                    │  │   Context Builder     │  │ ← 构建LLM上下文
                    │  │  ┌─────┐ ┌─────────┐  │  │
                    │  │  │Short│ │Retrieved│  │  │
                    │  │  │Term │ │ Memory  │  │  │
                    │  │  └─────┘ └─────────┘  │  │
                    │  └───────────┬───────────┘  │
                    │              │              │
                    │  ┌───────────▼───────────┐  │
                    │  │   Response Generator  │  │ ← 调用LLM生成回复
                    │  └───────────┬───────────┘  │
                    │              │              │
                    │  ┌───────────▼───────────┐  │
                    │  │   Memory Updater      │  │ ← 更新记忆系统
                    │  └───────────────────────┘  │
                    └─────────────────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   User Output   │
                         └─────────────────┘
```

**核心流程**:

```python
class AgentOrchestrator:
    def process(self, user_input: str) -> AgentResponse:
        # 1. 分类意图
        intent = self.classify_intent(user_input)

        # 2. 根据意图路由
        if intent == Intent.CHAT:
            return self._handle_chat(user_input)
        elif intent == Intent.ADD_KNOWLEDGE:
            return self._handle_add_knowledge(user_input)
        elif intent == Intent.SEARCH:
            return self._handle_search(user_input)

    def _handle_chat(self, user_input: str) -> AgentResponse:
        # 2.1 检索相关记忆
        relevant_memories = self.memory_manager.retrieve(user_input)

        # 2.2 获取短期记忆(会话历史)
        session_context = self.memory_manager.get_session_context()

        # 2.3 构建完整上下文
        context = self._build_context(
            system_prompt=self.system_prompt,
            memories=relevant_memories,
            session=session_context,
            user_input=user_input
        )

        # 2.4 调用LLM
        response = self.llm_client.chat(context)

        # 2.5 更新记忆
        self.memory_manager.add_to_session(user_input, response)
        self.memory_manager.maybe_persist_to_long_term(user_input, response)

        return AgentResponse(content=response, sources=relevant_memories)
```

### 2.2 Memory Manager (记忆管理器)

**三层记忆架构**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Memory Manager                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Working Memory (工作记忆)                       │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ • 当前任务上下文                                      │   │   │
│  │  │ • 活跃的检索结果                                      │   │   │
│  │  │ • 临时计算中间结果                                    │   │   │
│  │  │ • 容量: 动态，任务结束即清除                          │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ▲                                      │
│                              │ 提升                                 │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Short-term Memory (短期记忆)                    │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ • 当前会话对话历史                                    │   │   │
│  │  │ • 最近 K 轮对话 (K=10)                               │   │   │
│  │  │ • 会话结束后可选择性持久化                            │   │   │
│  │  │ • 存储: 内存 + Session JSON                          │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ▲                                      │
│                              │ 整合                                 │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Long-term Memory (长期记忆)                     │   │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐     │   │
│  │  │   Episodic    │ │   Semantic    │ │  Procedural   │     │   │
│  │  │   情景记忆    │ │   语义记忆    │ │   程序记忆    │     │   │
│  │  │               │ │               │ │               │     │   │
│  │  │ • 具体事件    │ │ • 概念知识    │ │ • 用户偏好    │     │   │
│  │  │ • 时间戳标记  │ │ • 事实信息    │ │ • 操作习惯    │     │   │
│  │  │ • 情境细节    │ │ • 知识库内容  │ │ • 常用模式    │     │   │
│  │  └───────────────┘ └───────────────┘ └───────────────┘     │   │
│  │  存储: ChromaDB (Vector Store)                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**记忆检索策略**:

```python
class MemoryManager:
    def retrieve(self, query: str, top_k: int = 5) -> List[Memory]:
        # 1. 语义检索 - 向量相似度
        semantic_results = self.vector_store.similarity_search(
            query=query,
            k=top_k * 2  # 多检索一些用于重排序
        )

        # 2. 时间加权 - 最近的记忆权重更高
        for memory in semantic_results:
            recency_score = self._calculate_recency(memory.last_accessed)
            memory.score = memory.score * 0.7 + recency_score * 0.3

        # 3. 重要性加权
        for memory in semantic_results:
            memory.score = memory.score * 0.8 + memory.importance * 0.2

        # 4. 排序并返回 top_k
        semantic_results.sort(key=lambda m: m.score, reverse=True)
        return semantic_results[:top_k]
```

**记忆重要性评估**:

```python
def _assess_importance(self, content: str, context: dict) -> float:
    """
    评估记忆的重要性 (0-1)

    考虑因素:
    - 情感强度: 强烈情感的内容更重要
    - 新颖性: 新信息比重复信息更重要
    - 关联性: 与已有知识关联多的更重要
    - 明确标记: 用户明确说"记住这个"
    """
    importance = 0.5  # 基础分

    # 检测情感强度
    if self._has_strong_emotion(content):
        importance += 0.2

    # 检测新颖性
    if self._is_novel(content):
        importance += 0.15

    # 检测用户明确标记
    if self._user_marked_important(content, context):
        importance += 0.3

    return min(importance, 1.0)
```

### 2.3 Knowledge Processor (知识处理器)

**多模态处理流程**:

```
┌────────────────────────────────────────────────────────────────────┐
│                     Knowledge Processor                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   Input File                                                       │
│       │                                                            │
│       ▼                                                            │
│   ┌─────────────────┐                                              │
│   │ Format Detector │ ── 检测文件类型                               │
│   └────────┬────────┘                                              │
│            │                                                       │
│            ├──────────────┬───────────────┬──────────────┐        │
│            ▼              ▼               ▼              ▼        │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐   │
│   │   Text      │ │   Image     │ │   Audio     │ │   PDF    │   │
│   │  Processor  │ │  Processor  │ │  Processor  │ │ Processor│   │
│   │             │ │             │ │             │ │          │   │
│   │ • Chunking  │ │ • Vision    │ │ • Whisper   │ │ • Extract│   │
│   │ • Cleaning  │ │   LLM       │ │   ASR       │ │ • OCR    │   │
│   │             │ │ • OCR       │ │             │ │          │   │
│   └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └────┬─────┘   │
│          │               │               │              │         │
│          └───────────────┴───────────────┴──────────────┘         │
│                                  │                                 │
│                                  ▼                                 │
│                    ┌─────────────────────────┐                    │
│                    │   Document Normalizer   │                    │
│                    │   统一为 Document 格式   │                    │
│                    └────────────┬────────────┘                    │
│                                 │                                  │
│                                 ▼                                  │
│                    ┌─────────────────────────┐                    │
│                    │   Embedding Generator   │                    │
│                    │   生成向量表示           │                    │
│                    └────────────┬────────────┘                    │
│                                 │                                  │
│                                 ▼                                  │
│                    ┌─────────────────────────┐                    │
│                    │     Vector Store        │                    │
│                    │     存入向量数据库       │                    │
│                    └─────────────────────────┘                    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**文本分块策略**:

```python
class TextProcessor:
    def chunk(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """
        智能分块策略:
        1. 优先按语义边界分割 (段落、章节)
        2. 其次按句子边界分割
        3. 最后按字符数分割

        保持 overlap 以维护上下文连贯性
        """
        chunks = []

        # 尝试按段落分割
        paragraphs = text.split('\n\n')

        current_chunk = ""
        for para in paragraphs:
            if len(current_chunk) + len(para) < chunk_size:
                current_chunk += para + "\n\n"
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    # 保留 overlap
                    current_chunk = current_chunk[-overlap:] + para + "\n\n"
                else:
                    # 单段落超长，按句子分割
                    chunks.extend(self._chunk_by_sentences(para, chunk_size, overlap))
                    current_chunk = ""

        if current_chunk:
            chunks.append(current_chunk.strip())

        return chunks
```

### 2.4 LLM Client (大模型客户端)

**统一接口设计**:

```
┌────────────────────────────────────────────────────────────────────┐
│                          LLM Client                                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   ┌────────────────────────────────────────────────────────────┐  │
│   │                    Unified Interface                        │  │
│   │                                                             │  │
│   │   chat(messages) -> str                                     │  │
│   │   embed(text) -> List[float]                                │  │
│   │   vision(image, prompt) -> str                              │  │
│   │                                                             │  │
│   └──────────────────────────┬─────────────────────────────────┘  │
│                              │                                     │
│              ┌───────────────┼───────────────┐                    │
│              ▼               ▼               ▼                    │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│   │   Anthropic  │  │    OpenAI    │  │    Ollama    │           │
│   │   Provider   │  │   Provider   │  │   Provider   │           │
│   │              │  │              │  │              │           │
│   │  Claude API  │  │  GPT-4 API   │  │ Local Models │           │
│   └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**配置示例**:

```yaml
# config.yaml
llm:
  provider: anthropic  # anthropic | openai | ollama
  model: claude-sonnet-4-20250514

  # Provider-specific settings
  anthropic:
    api_key: ${ANTHROPIC_API_KEY}
    max_tokens: 4096

  openai:
    api_key: ${OPENAI_API_KEY}
    model: gpt-4-turbo

  ollama:
    base_url: http://localhost:11434
    model: llama2

embeddings:
  provider: local  # local | openai
  model: all-MiniLM-L6-v2  # sentence-transformers model
```

## 3. 数据流详解

### 3.1 对话流程 (Chat Flow)

```
┌─────┐    ┌─────────────┐    ┌──────────────┐    ┌──────────┐    ┌─────────┐
│User │───▶│   CLI/API   │───▶│ Orchestrator │───▶│  Memory  │───▶│Retrieved│
│Input│    │             │    │              │    │ Manager  │    │Memories │
└─────┘    └─────────────┘    └──────────────┘    └──────────┘    └────┬────┘
                                     │                                  │
                                     │◀─────────────────────────────────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │   Context    │
                              │   Builder    │
                              │              │
                              │ System Prompt│
                              │ + Memories   │
                              │ + Session    │
                              │ + User Input │
                              └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐    ┌──────────┐
                              │  LLM Client  │───▶│ LLM API  │
                              │              │◀───│          │
                              └──────┬───────┘    └──────────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │   Memory     │
                              │   Updater    │
                              │              │
                              │ • Session    │
                              │ • Long-term  │
                              └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │   Response   │───▶ User Output
                              └──────────────┘
```

### 3.2 知识导入流程 (Import Flow)

```
┌──────┐    ┌───────────┐    ┌────────────┐    ┌──────────┐
│ File │───▶│  Format   │───▶│ Processor  │───▶│ Chunks   │
│      │    │ Detector  │    │ (text/img/ │    │          │
└──────┘    └───────────┘    │  audio)    │    └────┬─────┘
                             └────────────┘         │
                                                    ▼
                                            ┌──────────────┐
                                            │  Embedding   │
                                            │  Generator   │
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │ Vector Store │
                                            │  (ChromaDB)  │
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │  Metadata    │
                                            │   Store      │
                                            └──────────────┘
```

## 4. 上下文构建策略

### 4.1 Prompt 模板

```python
SYSTEM_PROMPT = """你是 MemoMind，一个具有记忆能力的个人AI助手。

## 你的能力
- 记住用户告诉你的重要信息
- 基于知识库内容回答问题
- 保持对话的连贯性和个性化

## 当前上下文
{context_section}

## 回答指南
1. 如果问题涉及知识库内容，优先使用检索到的信息
2. 如果记忆中有相关信息，自然地融入回答
3. 如果信息来源明确，标注来源
4. 保持回答简洁、准确、有帮助
"""

CONTEXT_TEMPLATE = """
### 相关记忆
{memories}

### 知识库参考
{knowledge_refs}
"""
```

### 4.2 上下文窗口管理

```
┌────────────────────────────────────────────────────────────┐
│                    Context Window                          │
│                    (e.g., 100K tokens)                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ System Prompt (固定)                        ~500 tokens│ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Retrieved Memories (动态)                 ~2000 tokens│ │
│  │ - 按相关性排序                                        │ │
│  │ - 最多 5 条                                           │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Knowledge References (动态)               ~3000 tokens│ │
│  │ - RAG 检索结果                                        │ │
│  │ - 最多 3 个文档片段                                   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Session History (滑动窗口)                ~4000 tokens│ │
│  │ - 最近 K 轮对话                                       │ │
│  │ - 超出时进行摘要压缩                                  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Current User Input                         ~500 tokens│ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Reserved for Response                    ~4000 tokens│ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## 5. 存储设计

### 5.1 ChromaDB Collection 设计

```python
# 知识库 Collection
knowledge_collection = {
    "name": "knowledge",
    "metadata": {"description": "User knowledge base"},
    "embedding_function": sentence_transformer_ef,
}

# 文档结构
document = {
    "id": "doc_uuid",
    "embedding": [0.1, 0.2, ...],  # 384维向量
    "document": "文档内容...",
    "metadata": {
        "source": "file_path",
        "modality": "text",
        "created_at": "2026-02-05T10:00:00Z",
        "tags": ["tag1", "tag2"],
        "chunk_index": 0,
        "total_chunks": 5
    }
}

# 记忆 Collection
memory_collection = {
    "name": "memories",
    "metadata": {"description": "Long-term memories"},
}

# 记忆结构
memory = {
    "id": "mem_uuid",
    "embedding": [0.1, 0.2, ...],
    "document": "记忆内容...",
    "metadata": {
        "type": "episodic",  # episodic | semantic | procedural
        "importance": 0.8,
        "access_count": 5,
        "last_accessed": "2026-02-05T10:00:00Z",
        "created_at": "2026-02-01T10:00:00Z",
        "source_doc_id": "doc_uuid"  # 可选
    }
}
```

### 5.2 Session 存储格式

```json
{
  "session_id": "session_uuid",
  "created_at": "2026-02-05T10:00:00Z",
  "updated_at": "2026-02-05T11:30:00Z",
  "messages": [
    {
      "role": "user",
      "content": "你好，记住我喜欢Python",
      "timestamp": "2026-02-05T10:00:00Z"
    },
    {
      "role": "assistant",
      "content": "你好！我记住了，你喜欢Python编程语言...",
      "timestamp": "2026-02-05T10:00:01Z",
      "metadata": {
        "memories_used": ["mem_123"],
        "knowledge_refs": []
      }
    }
  ],
  "summary": "用户介绍了自己对Python的偏好..."
}
```

## 6. 配置系统

### 6.1 配置文件结构

```yaml
# ~/.memomind/config.yaml

# LLM 配置
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  temperature: 0.7
  max_tokens: 4096

# 嵌入模型配置
embeddings:
  provider: local
  model: all-MiniLM-L6-v2

# 记忆配置
memory:
  short_term:
    max_messages: 20  # 会话保留消息数
  long_term:
    importance_threshold: 0.6  # 低于此值不持久化
    retrieval_top_k: 5
  consolidation:
    enabled: true
    interval_hours: 24

# 知识库配置
knowledge:
  chunk_size: 500
  chunk_overlap: 50
  max_file_size_mb: 50

# 存储配置
storage:
  base_path: ~/.memomind/data
  vector_db: chroma

# 日志配置
logging:
  level: INFO
  file: ~/.memomind/logs/memomind.log
```

## 7. 错误处理

### 7.1 错误类型

```python
class MemoMindError(Exception):
    """Base exception for MemoMind"""
    pass

class LLMError(MemoMindError):
    """LLM API related errors"""
    pass

class StorageError(MemoMindError):
    """Storage related errors"""
    pass

class ProcessingError(MemoMindError):
    """Document processing errors"""
    pass

class ConfigError(MemoMindError):
    """Configuration errors"""
    pass
```

### 7.2 重试策略

```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(LLMError)
)
def call_llm(self, messages: List[Message]) -> str:
    """带重试的 LLM 调用"""
    pass
```

## 8. 安全考虑

### 8.1 API Key 管理

```python
# 使用 keyring 安全存储
import keyring

def set_api_key(provider: str, key: str):
    keyring.set_password("memomind", provider, key)

def get_api_key(provider: str) -> str:
    return keyring.get_password("memomind", provider)
```

### 8.2 数据隔离

- 所有数据存储在 `~/.memomind/` 目录
- 不进行任何网络传输（除 LLM API 调用）
- 支持数据加密（可选）

---

*架构文档版本: v0.1.0 | 最后更新: 2026-02-05*
