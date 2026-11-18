<p align="center">
  <img src="https://raw.githubusercontent.com/bot-anica/md-viewer-py/main/assets/logo.png" alt="md-viewer-py" width="120">
</p>

<h1 align="center">md-viewer-py</h1>

<p align="center">
  <a href="https://pypi.org/project/md-viewer-py/"><img src="https://img.shields.io/pypi/v/md-viewer-py?label=version" alt="PyPI 版本"></a>
  <img src="https://img.shields.io/pypi/pyversions/md-viewer-py" alt="Python 版本">
  <img src="https://img.shields.io/pypi/l/md-viewer-py" alt="许可证">
</p>

<p align="center"><strong>面向任意文件夹的即插即用 Markdown 查看器</strong></p>

一个本地 HTTP 服务器，可在浏览器中渲染 Markdown 文件，并支持导航、搜索与编辑。安装并运行：

```bash
pip install md-viewer-py
mdview
```

<p align="center">
  <a href="https://youtu.be/uZRkSmzfyzY">
    <img src="https://raw.githubusercontent.com/bot-anica/md-viewer-py/main/assets/video-thumbnail.png" alt="观看演示" width="100%">
  </a>
  <br>
  <em>▶ 点击观看演示</em>
</p>


## 为什么选择 mdview？

把它指向任意文件夹，即可立刻浏览文档——无需配置文件、无需构建步骤、无需 Node.js。它自带侧边栏导航、全局搜索、目录、深色模式、Mermaid 图表、语法高亮，以及带实时预览的浏览器内编辑器。这一切都由 Python 标准库的 HTTP 服务器和唯一依赖（`watchdog`）驱动。

## mdview 与其他方案对比

| | mdview | MkDocs / Docusaurus | VS Code 预览 | grip |
|---|---|---|---|---|
| 安装配置 | `pip install` | 配置 + 构建 + Node.js | 已安装 | `pip install` |
| 多文件导航 | ✅ | ✅ | ❌ | ❌ |
| 跨文件搜索 | ✅ | ✅ | ❌ | ❌ |
| 实时重载 | ✅ | ✅（需插件） | ✅ | ❌ |
| 浏览器内编辑 | ✅ | ❌ | ✅ | ❌ |
| 是否需要配置 | 无 | ✅ | ❌ | API 令牌 |
| 可离线使用 | ✅ | ✅ | ✅ | ❌ |

## 安装

```bash
pip install md-viewer-py
```

也可以使用 [uv](https://docs.astral.sh/uv/) / [pipx](https://pipx.pypa.io/)：

```bash
uv tool install md-viewer-py
pipx install md-viewer-py
```

然后在任意目录下运行：

```bash
mdview                        # 在 8080 端口提供当前目录
mdview --port 3000            # 自定义端口
mdview /path/to/docs          # 自定义目录
mdview /path/to/docs -p 3000  # 同时指定目录和端口
mdview /path/to/docs --readonly     # 禁用编辑（适合公开托管）
mdview --help                 # 显示全部选项
```

## 全部功能

- **仪表盘**：文件夹与文件的网格视图，类似 macOS Finder
- **深色与浅色主题**：自动跟随系统偏好，也可手动切换
- **文件树侧边栏**：可折叠目录，并支持按文件名筛选
- **全局搜索**：从顶栏搜索全部文件，以下拉结果展示
- **文件内搜索**：Cmd/Ctrl+F 查找并高亮匹配项
- **目录**：右侧面板，带滚动定位与可折叠分组
- **浏览器内编辑**：编辑模式带实时预览，保存到磁盘
- **实时重载**：磁盘上的文件变化会立即更新
- **语法高亮**：覆盖主流语言的代码块
- **Mermaid 图表**：内联渲染，并给出错误反馈
- **LaTeX 数学公式**：行内 `$...$` 与块级 `$$...$$`，由 KaTeX 渲染
- **音频播放**：为 mp3、wav、ogg、m4a、aac、flac、opus 提供内联 `<audio>` 播放器
- **键盘快捷键**：完整快捷键集，按 `?` 打开说明弹窗
- **适合打印**：干净的样式表，并正确分页
- **完整的命令行**：`--help`、`--port`、`--host`、`--no-browser`、`--readonly`
- **依赖极少**：仅 `watchdog`，可通过 pip 安装

## 键盘快捷键

| 按键 | 操作 |
|-----|--------|
| `⌘/Ctrl+F` | 在当前文件中查找 |
| `⌘/Ctrl+Shift+F` | 跨全部文件搜索 |
| `Shift Shift` | 按名称筛选文件 |
| `/` | 聚焦搜索（旧版快捷键） |
| `?` | 显示键盘快捷键 |
| `← ↑` | 上一个文件 |
| `→ ↓` | 下一个文件 |
| `Escape` | 关闭搜索 / 弹窗 |

## 示例

- [Mermaid 图表](https://github.com/bot-anica/md-viewer-py/blob/main/examples/mermaid-examples.md)：流程图、时序图、甘特图等
- [LaTeX 数学公式](https://github.com/bot-anica/md-viewer-py/blob/main/examples/math-examples.md)：通过 KaTeX 渲染行内与块级公式
- [音频播放](https://github.com/bot-anica/md-viewer-py/blob/main/examples/audio-examples.md)：常见格式的内联音频播放器

## 工作原理

`md-viewer-py` 是一个可通过 pip 安装的 HTTP 服务器，基于 Python 的 `http.server`。它扫描目录中的 `.md` 文件，提供带深色与浅色主题的单页界面，并在客户端使用 CDN 上的 [marked.js](https://github.com/markedjs/marked) 渲染 Markdown。没有构建步骤，也没有配置文件。安装后即可运行。

## 公开构建

关注开发过程：

- [如何把 2800 行代码拆成 29 个文件且零回归](https://blog.anica.space/posts/md-viewer-refactoring-monolith-to-modules)
- [从查看器到工作区：用 9 天重做 md-viewer-py](https://blog.anica.space/posts/md-viewer-from-viewer-to-workspace)
- [我的业余项目遇到了第一个安全漏洞](https://blog.anica.space/posts/md-viewer-first-security-vulnerability)
- [我用 Python 做了一个零依赖的 Markdown 查看器](https://blog.anica.space/posts/md-viewer-zero-dependency-markdown-viewer)

## 参与贡献

欢迎贡献！请参阅 [CONTRIBUTING.md](https://github.com/bot-anica/md-viewer-py/blob/main/CONTRIBUTING.md) 了解规范，以及[改进与想法列表](https://github.com/bot-anica/md-viewer-py/blob/main/IMPROVEMENTS.md) 查看待办事项。

动手之前，也可以先[提交 issue](https://github.com/bot-anica/md-viewer-py/issues) 讨论想法。

## 许可证

[MIT](https://github.com/bot-anica/md-viewer-py/blob/main/LICENSE)

安装使用后，随时可以用 `pip uninstall md-viewer-py` 卸载。
