# UI UX Pro Max 安装记录

- 请求来源：用户指定 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill 并要求下载、应用。
- 固定版本：`28b3b8dee8c976df4fa3e94aed4e092ad43fcb03`。
- 来源目录：`.claude/skills/ui-ux-pro-max`，保留完整 73 个源文件，约 3.58 MB。
- 安装目录：`C:\Users\raw_0\.codex\skills\ui-ux-pro-max`。
- 使用官方 skill-installer 的 GitHub 安装脚本；先下载到本次对话的审查目录，检查后安装到技能目录，没有覆盖已有技能。
- 全量读取并解析配套 CSV/JSON；检查 Python AST、导入、文件写入及可疑指令，人工核对入口、设计方案持久化代码和说明文档。没有执行仓库的测试、安装钩子或 CLI。
- 检索入口只用 Python 标准库，读取本地数据；未发现发送项目内容或读取凭据的调用。`--persist` 可在指定输出目录创建方案文件，`--force` 可覆盖已有方案，本次不使用强制覆盖。
- 源文件与安装文件逐个 SHA-256 比对：73 / 73 相同。完整清单存放在本次对话可视化目录的 `skill-inventory.json`。
- 上游根目录 LICENSE 为 MIT；安装目录另外添加 `LICENSE.txt` 和 `ORIGIN.md`，保留许可证和来源说明；73 个上游原文件未修改。
- 这是针对所用版本的简要风险检查，不是无恶意代码保证；设计建议需要结合业务核对，生成器有时会返回不适合中文经营工作台的营销布局或字体。

后续新一轮对话可自动发现该技能；本次已读取其说明，直接运行本地检索。
