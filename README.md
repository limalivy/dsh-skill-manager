# dsh-skill-manager

> 给 DeepSeek Harness 的输入框加一个「＋ 技能管理」入口：直接在 Web UI 里浏览、新建、编辑、删除本地技能（`SKILL.md`）和规则（`AGENTS.md`），不用切出窗口改文件。

DSH 的技能与规则都来自文件系统（分别由 `@deepseek-ai/dsh-skill-filesystem` 与 `@deepseek-ai/dsh-agent-instructions` 提供），原生只有读取能力。本插件补上写入的那一侧：Host 半在 `/skill-manager` 上暴露一组受限 JSON 接口，Client 半把它渲染成面板。

## 能力

- 浏览 4 个技能根下的全部技能，按来源分组，支持搜索与「全部 / 用户 / 项目」过滤
- 新建技能：校验 kebab-case 名称与必填描述，写入所选根
- 编辑技能：描述、触发条件（`whenToUse`）、正文，以及 `disable-model-invocation`、`user-invocable` 两个开关
- 删除技能：两次点击确认
- 规则管理：4 个 `AGENTS.md` 目标文件的读取与保存，保存后回显字节数与时间
- 改写 frontmatter 时逐行保留未触碰内容，只替换目标字段

## 环境要求

- DeepSeek Harness 桌面版或 Web 版，且使用 profile
- 无构建步骤：源码即产物，ESM JavaScript + React（React 由宿主提供）

## 安装

在 DSH 里调用 `plugin_manager`：

```
action: install_bundle
target: <本仓库的绝对路径>
```

安装后 profile 的 `package.json` 会新增依赖与 bundle 条目，插件的 Loader 行由包内 `cordis.patch.yml` 提供：

```yaml
- insert:
    - id: skill-manager
      name: '@limalivy/dsh-skill-manager'
      inject: [connection, webServer]
```

**改过包名或首次安装后需要完全退出并重开 DSH**：客户端模块表只在进程启动时重建，只刷新页面会残留旧包名。

## 使用

聊天输入框下方会多出一条按钮栏：

1. 点「＋ 技能管理」打开面板
2. 左侧选技能，或切到「规则」页签
3. 改完点保存；删除需要连点两次
4. `Esc` 关闭面板

## 技能根

与 `@deepseek-ai/dsh-skill-filesystem` 一致，数字小者优先：

| id | 路径 | 作用域 |
|---|---|---|
| `project-dsh` | `<项目>/.dsh/skills` | 项目 |
| `project-agents` | `<项目>/.agents/skills` | 项目 |
| `user-dsh` | `$DSH_HOME/skills`（默认 `~/.dsh/skills`） | 用户 |
| `user-agents` | `<agentsHome>/skills`（默认 `~/.agents/skills`） | 用户 |

技能既可以是 `<名字>/SKILL.md`，也可以是 `<名字>.md`。frontmatter 必须含 kebab-case 的 `name` 与非空 `description`，可选 `whenToUse`、`disable-model-invocation`、`user-invocable`。

## 规则目标

| id | 文件 |
|---|---|
| `user-dsh` | `~/.dsh/AGENTS.md` |
| `user-agents` | `~/.agents/AGENTS.md` |
| `project-root` | `<项目>/AGENTS.md` |
| `project-local` | `<项目>/AGENTS.local.md` |

保存后在下一次模型请求时生效。

## HTTP 接口

全部为 `POST`，路径前缀 `/skill-manager`：

| 端点 | 作用 |
|---|---|
| `list` | 列出全部技能与所在根 |
| `read` | 读取单个技能 |
| `create` | 新建技能 |
| `save` | 保存技能 |
| `remove` | 删除技能 |
| `rules-list` | 列出规则目标及其存在性 |
| `rules-read` | 读取规则文件 |
| `rules-save` | 写入规则文件 |
| `rules-remove` | 删除规则文件 |

安全边界：

- 每个请求先过 `ctx.connection.requestRejection`，未认证一律 401
- 只接受 `POST`，其余方法 405
- 请求体上限 512 KiB，单文件上限 1 MiB
- 目标路径必须严格等于 `<root>/<name>/SKILL.md` 或 `<root>/<name>.md`，并用 realpath 校验不会被符号链接带出根目录

## 开发

```
client.js              Client 半：面板与交互（单组件）
host3.js               Host 半：路由、发现、frontmatter 读写、路径守卫
cordis.patch.yml      安装后写进 profile 的 Loader 行
locale/{en,zh}.json   显示元数据
icon.svg              图标
skill-manager-test.mjs  Host 接口测试（真实 handler + 假 ctx）
```

```bash
npm test
```

测试在临时目录里造一套 `DSH_HOME`、agentsHome 与项目目录，直接驱动真实的 HTTP handler，覆盖列出、读取、保存、新建、重名、非法名称、路径逃逸与删除。

## 已知限制

- 入口挂在 `conversation.composer.dock`，不在设置页
- 不支持技能改名，也不支持导入已有目录
- 写入不经过 DSH 的文件工具，因此不会出现在「变更文件」卡片里；规则保存的字节数与时间是插件自己回显的
- 改包名后旧名字会残留在客户端模块表，直到进程重启
