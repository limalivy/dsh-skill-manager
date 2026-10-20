# AGENTS.md

本文件面向在本仓库中工作的编码 agent。内容只描述这个仓库自身的事实与约束。

## 仓库是什么

一个 DeepSeek Harness 持久化插件，Host 半与 Client 半在同一个包里：

- **Host 半**（`host3.js`）：注册 `/skill-manager` HTTP 路由，发现技能与规则文件，做增删改查与路径守卫。
- **Client 半**（`client.js`）：在 `conversation.composer.dock` 挂一个按钮条，展开为管理面板。

两半通过同源 `fetch('/skill-manager/<endpoint>')` 通信，不经过 Remote 层。

## 目录结构

| 文件 | 职责 |
|---|---|
| `host3.js` | 路由分发、根发现、frontmatter 读写、路径守卫。`package.json` 的 `exports["."]` 指向它 |
| `client.js` | `window.__ModuleLoader__.load({ id, factory })`，导出 `{ inject, apply }` |
| `cordis.patch.yml` | 安装后写进 profile 的 Loader 行 |
| `skill-manager-test.mjs` | Host 接口测试，用假 ctx 驱动真实 HTTP handler |
| `locale/{en,zh}.json` | 显示元数据（`meta.title` / `meta.description`） |
| `icon.svg` | 插件图标 |
| `host2.js` | 历史遗留入口，不在 `exports` / `files` 中，不参与打包 |

## 命令

```bash
node --check host3.js && node --check client.js   # 语法
npm test                                          # Host 接口测试
```

没有构建步骤，没有依赖安装，没有 lint 配置。

## 必须保持的不变量

违反其中任意一条，插件会静默失效或直接报错。

**1. 标识一致**

`package.json.name`、`client.js` 中 `__ModuleLoader__.load({ id })` 的 `id`、`cordis.patch.yml` 的 `name`、profile 里的依赖键，四处必须同一个包名。`id` 与包名不一致会报 `loaded without registering "<pkg>"`。

**2. dock 入口 id 唯一**

当前为 `dsh-skill-manager`。与其他插件撞 id 会报 `list slot "conversation.composer.dock" already has an entry with id ...`。

**3. Client 半单组件**

整个面板是一个组件，元素只用 `div` / `button` / `input` / `textarea` / `select` / `style`。不要拆子组件、不要引第三方 UI 库、不要注册 `settings.section`：第三方 client 插件的组合组件在真实页面上不会提交渲染，表现为面板一片空白。颜色只用 `--dsw-alias-*` 令牌，样式类统一 `sm-` 前缀。

**4. Host 半的注入方式**

`apply` 内用 `ctx.inject(['connection', 'webServer'], scoped => ...)`，再 `scoped.webServer.register({ kind: 'prefix', path: '/skill-manager', handler })`。不要用 `ctx.connection.rpc.handle`：connection 服务的 `this.ctx` 没有 `webServer` 注入，会抛 `cannot get property "webServer" without inject`。

**5. 每个请求先鉴权**

handler 第一步调用 `ctx.connection.requestRejection({ headers })`，返回非 `undefined` 即回 401。非 `POST` 回 405。

**6. 路径守卫**

目标必须严格等于 `<root>/<name>/SKILL.md` 或 `<root>/<name>.md`，并用 realpath 校验仍在根内，不允许符号链接带出根目录。新建时校验名称是 kebab-case、描述非空。

**7. 上限**

请求体 512 KiB，单文件 1 MiB。

## 数据面

技能根（数字小者优先）：

| id | 路径 |
|---|---|
| `project-dsh` | `<项目>/.dsh/skills` |
| `project-agents` | `<项目>/.agents/skills` |
| `user-dsh` | `$DSH_HOME/skills` |
| `user-agents` | `<agentsHome>/skills` |

规则目标：

| id | 文件 |
|---|---|
| `user-dsh` | `~/.dsh/AGENTS.md` |
| `user-agents` | `~/.agents/AGENTS.md` |
| `project-root` | `<项目>/AGENTS.md` |
| `project-local` | `<项目>/AGENTS.local.md` |

frontmatter 必须有 kebab-case 的 `name` 与非空 `description`，可选 `whenToUse`、`disable-model-invocation`、`user-invocable`。改写时逐行保留未触碰内容，只替换目标字段。

## 修改流程

1. 改动前先跑 `npm test` 拿到基线。
2. 改完再跑一次 `npm test`；Host 行为变更必须新增或调整测试用例。
3. 语法检查两个入口文件。
4. 生效：`plugin_manager` 重新 `install_bundle`，读返回的 `application` 字段判断是否 live。
5. 改了包名、Loader 行或 Host 入口文件名后，必须完全重启 DSH；客户端模块表只在进程启动时重建，只刷新页面会残留旧包名。

**验证边界**：本仓库没有浏览器控制能力。面板到底渲染成什么样，只能请用户确认，不要声称"已验证通过渲染"。

## 仓库约定

- 最小改动：每一行改动都要能追溯到需求，不顺手重构无关代码。
- 发现既有死代码（如 `host2.js`）时先说明，不要自行删除。

## 已知陷阱

- **模块缓存**：改 Host 入口后旧代码可能不生效。历史上通过换入口文件名（`host.js` → `host2.js` → `host3.js`）绕过，现在 `host3.js` 是唯一入口，需保持一致。
- **客户端名册增量扫描**：删掉或改名一个包后，旧条目会留在内存里直到进程重启。
- **写文件不经过 DSH 文件工具**：因此不会出现在「变更文件」卡片中，这是预期行为而非缺陷。

## 扩展前先读

- `README.md`：能力、安装、接口清单。
- `host3.js` 顶部的常量与 `serve()`：路由与错误码的真实来源。
- 接口表以 `README.md` 与实际 `case` 分支为准，任何一侧改动都要同步另一侧。
