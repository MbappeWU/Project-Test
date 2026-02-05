"""Main CLI application for MemoMind."""

import typer
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.markdown import Markdown

from memomind import __version__

app = typer.Typer(
    name="memomind",
    help="MemoMind - A multimodal personal memory agent",
    no_args_is_help=True,
)
console = Console()


@app.command()
def chat():
    """Start an interactive chat session with MemoMind."""
    from memomind.core.agent import AgentOrchestrator

    console.print(Panel.fit(
        "[bold blue]MemoMind[/bold blue] - 多模态个人记忆智能体\n"
        f"版本: {__version__}\n\n"
        "[dim]输入 'exit' 或 'quit' 退出，输入 'clear' 清除会话[/dim]",
        title="欢迎",
    ))

    try:
        agent = AgentOrchestrator()
    except Exception as e:
        console.print(f"[red]初始化失败: {e}[/red]")
        console.print("[yellow]请检查配置和API密钥设置[/yellow]")
        raise typer.Exit(1)

    console.print()

    while True:
        try:
            user_input = Prompt.ask("[bold green]你[/bold green]")

            if user_input.lower() in ("exit", "quit", "q"):
                agent.save_session()
                console.print("[dim]会话已保存，再见！[/dim]")
                break

            if user_input.lower() == "clear":
                agent.new_session()
                console.print("[dim]会话已清除[/dim]")
                continue

            if not user_input.strip():
                continue

            with console.status("[bold blue]思考中...[/bold blue]"):
                response = agent.process(user_input)

            console.print()
            console.print("[bold blue]MemoMind[/bold blue]:")
            console.print(Markdown(response.content))

            if response.sources:
                console.print()
                console.print("[dim]参考记忆:[/dim]")
                for source in response.sources[:3]:
                    console.print(f"  [dim]• {source.content[:50]}...[/dim]")

            console.print()

        except KeyboardInterrupt:
            agent.save_session()
            console.print("\n[dim]会话已保存，再见！[/dim]")
            break
        except Exception as e:
            console.print(f"[red]错误: {e}[/red]")


@app.command()
def add(
    path: str = typer.Argument(..., help="文件或目录路径"),
    tags: str = typer.Option(None, "--tags", "-t", help="标签，逗号分隔"),
):
    """Add a file or directory to the knowledge base."""
    from pathlib import Path
    from memomind.core.knowledge import KnowledgeProcessor

    processor = KnowledgeProcessor()
    file_path = Path(path)

    tag_list = [t.strip() for t in tags.split(",")] if tags else None

    if file_path.is_file():
        with console.status(f"[bold blue]处理 {file_path.name}...[/bold blue]"):
            try:
                docs = processor.add_file(str(file_path), tags=tag_list)
                console.print(f"[green]已添加 {len(docs)} 个文档块[/green]")
            except Exception as e:
                console.print(f"[red]添加失败: {e}[/red]")

    elif file_path.is_dir():
        files = list(file_path.rglob("*"))
        files = [f for f in files if f.is_file()]

        with console.status(f"[bold blue]处理 {len(files)} 个文件...[/bold blue]"):
            success = 0
            for f in files:
                try:
                    processor.add_file(str(f), tags=tag_list)
                    success += 1
                except Exception:
                    pass
            console.print(f"[green]成功添加 {success}/{len(files)} 个文件[/green]")

    else:
        console.print(f"[red]路径不存在: {path}[/red]")
        raise typer.Exit(1)


@app.command()
def note(
    content: str = typer.Argument(..., help="笔记内容"),
    title: str = typer.Option(None, "--title", "-t", help="笔记标题"),
    tags: str = typer.Option(None, "--tags", help="标签，逗号分隔"),
):
    """Add a quick note to the knowledge base."""
    from memomind.core.knowledge import KnowledgeProcessor

    processor = KnowledgeProcessor()
    tag_list = [t.strip() for t in tags.split(",")] if tags else None

    doc = processor.add_note(content, title=title, tags=tag_list)
    console.print(f"[green]笔记已添加 (ID: {doc.id[:8]}...)[/green]")


@app.command()
def search(
    query: str = typer.Argument(..., help="搜索查询"),
    limit: int = typer.Option(5, "--limit", "-n", help="结果数量"),
):
    """Search the knowledge base."""
    from memomind.core.knowledge import KnowledgeProcessor
    from rich.table import Table

    processor = KnowledgeProcessor()
    results = processor.search(query, top_k=limit)

    if not results:
        console.print("[yellow]未找到相关结果[/yellow]")
        return

    table = Table(title="搜索结果")
    table.add_column("ID", style="dim", width=10)
    table.add_column("类型", width=8)
    table.add_column("内容", width=60)
    table.add_column("来源", style="dim", width=20)

    for doc in results:
        content_preview = doc.content[:100] + "..." if len(doc.content) > 100 else doc.content
        source = doc.source_path or doc.title or "-"
        source = source[-20:] if len(source) > 20 else source

        table.add_row(
            doc.id[:8] + "...",
            doc.modality.value,
            content_preview,
            source,
        )

    console.print(table)


@app.command("list")
def list_docs(
    limit: int = typer.Option(20, "--limit", "-n", help="结果数量"),
    modality: str = typer.Option(None, "--type", "-t", help="过滤类型 (text/image/audio/pdf)"),
):
    """List documents in the knowledge base."""
    from memomind.core.knowledge import KnowledgeProcessor
    from rich.table import Table

    processor = KnowledgeProcessor()
    results = processor.list_documents(limit=limit, modality=modality)

    if not results:
        console.print("[yellow]知识库为空[/yellow]")
        return

    table = Table(title=f"知识库文档 ({len(results)} 条)")
    table.add_column("ID", style="dim", width=10)
    table.add_column("类型", width=8)
    table.add_column("标题/来源", width=30)
    table.add_column("创建时间", style="dim", width=20)

    for doc in results:
        title = doc.title or doc.source_path or "-"
        title = title[-30:] if len(title) > 30 else title

        table.add_row(
            doc.id[:8] + "...",
            doc.modality.value,
            title,
            doc.created_at.strftime("%Y-%m-%d %H:%M"),
        )

    console.print(table)


@app.command()
def memory(
    action: str = typer.Argument("list", help="操作: list, clear, stats"),
    limit: int = typer.Option(20, "--limit", "-n", help="结果数量"),
):
    """Manage memories."""
    from memomind.core.memory import MemoryManager
    from rich.table import Table

    manager = MemoryManager()

    if action == "list":
        memories = manager.get_all_memories(limit=limit)

        if not memories:
            console.print("[yellow]暂无记忆[/yellow]")
            return

        table = Table(title=f"记忆列表 ({len(memories)} 条)")
        table.add_column("ID", style="dim", width=10)
        table.add_column("类型", width=10)
        table.add_column("内容", width=50)
        table.add_column("重要性", width=8)
        table.add_column("访问", style="dim", width=6)

        for mem in memories:
            content_preview = mem.content[:80] + "..." if len(mem.content) > 80 else mem.content
            table.add_row(
                mem.id[:8] + "...",
                mem.memory_type.value,
                content_preview,
                f"{mem.importance:.2f}",
                str(mem.access_count),
            )

        console.print(table)

    elif action == "clear":
        if typer.confirm("确定要清除所有记忆吗？此操作不可恢复。"):
            manager.clear_all_memories()
            console.print("[green]所有记忆已清除[/green]")

    elif action == "stats":
        stats = manager.get_memory_stats()
        console.print(Panel.fit(
            f"总记忆数: {stats['total_memories']}\n"
            f"集合名称: {stats['collection_name']}",
            title="记忆统计",
        ))

    else:
        console.print(f"[red]未知操作: {action}[/red]")


@app.command()
def auth(
    action: str = typer.Argument("status", help="操作: login, logout, status"),
    provider: str = typer.Option(None, "--provider", "-p", help="提供商: anthropic, openai"),
):
    """Manage OAuth authentication."""
    from memomind.auth import OAuthManager, OAuthError
    from memomind.config import get_settings

    settings = get_settings()
    oauth = OAuthManager()

    if action == "status":
        # Show authentication status
        from memomind.llm.client import LLMClient

        client = LLMClient()
        current_provider = settings.llm.provider

        console.print(Panel.fit(
            f"[bold]当前提供商:[/bold] {current_provider}\n"
            f"[bold]认证方式:[/bold] {settings.llm.auth_method}\n"
            f"[bold]认证状态:[/bold] {client.get_auth_method()}",
            title="认证状态",
        ))

        # Show detailed status for each provider
        console.print("\n[bold]各提供商状态:[/bold]")
        status = oauth.get_auth_status()
        for prov, info in status.items():
            if info.get("logged_in"):
                expires = info.get("expires_at", "N/A")
                console.print(f"  {prov}: [green]已登录[/green] (过期: {expires})")
            else:
                console.print(f"  {prov}: [dim]未登录[/dim]")

    elif action == "login":
        # OAuth login
        target_provider = provider or settings.llm.provider

        if target_provider not in ("anthropic", "openai"):
            console.print(f"[red]不支持的提供商: {target_provider}[/red]")
            console.print("[yellow]支持: anthropic, openai[/yellow]")
            raise typer.Exit(1)

        console.print(f"[bold blue]正在启动 {target_provider} OAuth 登录...[/bold blue]")

        def status_callback(message: str):
            console.print(f"  [dim]{message}[/dim]")

        try:
            token = oauth.login(target_provider, callback=status_callback)
            console.print(f"\n[green]✅ {target_provider} 登录成功![/green]")

            # Update settings to use OAuth
            settings.llm.auth_method = "oauth"
            settings.save()
            console.print("[dim]已更新配置使用 OAuth 认证[/dim]")

        except OAuthError as e:
            console.print(f"\n[red]❌ 登录失败: {e}[/red]")
            raise typer.Exit(1)

    elif action == "logout":
        # OAuth logout
        target_provider = provider or settings.llm.provider

        if oauth.logout(target_provider):
            console.print(f"[green]已退出 {target_provider}[/green]")

            # Revert to API key auth
            settings.llm.auth_method = "api_key"
            settings.save()
        else:
            console.print(f"[yellow]{target_provider} 未登录[/yellow]")

    else:
        console.print(f"[red]未知操作: {action}[/red]")
        console.print("[yellow]可用操作: login, logout, status[/yellow]")


@app.command()
def config(
    action: str = typer.Argument("show", help="操作: show, set, init"),
    key: str = typer.Option(None, "--key", "-k", help="配置键"),
    value: str = typer.Option(None, "--value", "-v", help="配置值"),
):
    """Manage configuration."""
    from memomind.config import get_settings

    settings = get_settings()

    if action == "show":
        console.print(Panel.fit(
            f"LLM Provider: {settings.llm.provider}\n"
            f"LLM Model: {settings.llm.model}\n"
            f"Auth Method: {settings.llm.auth_method}\n"
            f"Embedding Model: {settings.embeddings.model}\n"
            f"Data Path: {settings.storage.base_path}\n"
            f"Log Level: {settings.log_level}",
            title="当前配置",
        ))

    elif action == "init":
        settings.ensure_directories()
        settings.save()
        console.print(f"[green]配置已初始化: {settings.config_file}[/green]")

    elif action == "set":
        if not key or not value:
            console.print("[red]请提供 --key 和 --value[/red]")
            raise typer.Exit(1)

        # Support setting auth method
        if key == "llm.auth_method":
            if value in ("api_key", "oauth"):
                settings.llm.auth_method = value
                settings.save()
                console.print(f"[green]已设置 {key}={value}[/green]")
            else:
                console.print("[red]auth_method 必须是 'api_key' 或 'oauth'[/red]")
        elif key == "llm.provider":
            if value in ("anthropic", "openai", "ollama"):
                settings.llm.provider = value
                settings.save()
                console.print(f"[green]已设置 {key}={value}[/green]")
            else:
                console.print("[red]provider 必须是 'anthropic', 'openai' 或 'ollama'[/red]")
        else:
            console.print(f"[yellow]配置设置功能开发中: {key}={value}[/yellow]")

    else:
        console.print(f"[red]未知操作: {action}[/red]")


@app.command()
def version():
    """Show version information."""
    console.print(f"MemoMind v{__version__}")


def main():
    """Entry point."""
    app()


if __name__ == "__main__":
    main()
