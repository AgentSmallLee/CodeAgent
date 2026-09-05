# LangChain Deep Agent 学习笔记

## 一、核心概念
Deep Agent 是 LangChain 推出的面向复杂项目级任务的新一代智能体架构，区别于传统只能处理单工具简单问答的基础Agent，核心包含以下3个核心特性：
1. **分层任务规划能力**
   内置原生规划模块，可自动将大型复杂任务拆解为多个子步骤，不再依赖人工分步引导，适合处理类似深度调研、全流程代码开发这类"像项目而不是单次提问"的复杂需求。
2. **子代理协同机制**
   支持动态生成专门的子代理分配专项任务，不同子代理可以拥有独立的上下文、工具集和专长领域，避免单代理上下文过载，大幅提升复杂任务完成质量。
3. **文件系统上下文管理**
   基于本地文件系统做持久化上下文存储，代理可以自动读写中间结果、保存调研笔记、生成输出文件，解决了传统大上下文窗口容易遗忘、信息不可追溯的痛点。

## 二、快速入门步骤
### 步骤1：安装依赖包
通过pip安装官方提供的独立`deepagents`库以及配套常用工具：
```bash
pip install langchain deepagents tavily-python python-dotenv
```
可选扩展依赖：如果需要对接OpenAI系列模型安装`langchain-openai`，需要做Web UI演示可以安装`streamlit`。

### 步骤2：配置环境变量
准备对应服务的API密钥并配置到环境中：
```bash
# 大模型服务商密钥（支持OpenAI、Groq等所有LangChain兼容的LLM）
export OPENAI_API_KEY=sk-xxxxxx
# 网页搜索工具密钥（Tavily）
export TAVILY_API_KEY=tvly-xxxxxx
# 可选：LangSmith监控密钥
export LANGSMITH_API_KEY=ls-xxxxxx
```
> 框架默认使用`claude-sonnet-4-5-20250929`模型，可自行替换为其他支持的大模型。

### 步骤3：初始化并运行Agent
编写最简启动代码，传入任务即可执行：
```python
from deepagents import DeepAgent

# 初始化代理
agent = DeepAgent()

# 执行调研任务
research_topic = "2025年AI Agent和LangGraph的最新进展"
result = agent.invoke({
    "messages": [{"role": "user", "content": research_topic}]
})

print("任务执行结果：", result)
```

### 步骤4：接入观测与调试
通过LangSmith平台可以追踪所有请求链路、调试代理行为、评估输出质量，快速定位子代理执行异常、规划逻辑出错等问题，为后续生产部署做准备。

## 三、注意事项
1. **场景适配**：Deep Agent是为复杂任务设计的，简单问答、单工具调用场景使用传统基础Agent即可，避免不必要的资源浪费。
2. **工具设计原则**：为Deep Agent扩展工具时要面向深度工作场景，比如调研、代码生成、文档处理类工具，不要添加过于细碎的单步工具，避免干扰代理的规划逻辑。
3. **自定义指令优化**：添加自定义提示词时要尽可能明确任务边界和输出规范，自定义指令会自动追加到内置系统提示词前，大幅提升输出符合预期的概率。
4. **生产部署建议**：上线生产环境前务必配置LangSmith中间件做全链路观测，开启文件系统持久化配置，保证任务执行过程可追溯、可恢复。