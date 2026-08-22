# dsh-balance

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-4A90D9?logo=deepseek&logoColor=white)](https://github.com/topics/dsh-plugin)

在 DeepSeek Harness 侧边栏底部显示当前 DeepSeek API 账户余额。
Shows your DeepSeek API balance at the bottom of the DSH sidebar.

## 功能 / Features

- 侧边栏底部新增一行「API 余额」，宽栏显示 `¥110.00` 这样的总余额；收起成 56px 轨道时只显示图标。
- **单击**立即刷新。
- **双击**打开 DeepSeek 平台用量页 `https://platform.deepseek.com/usage`。
- 每次当前会话完成一轮完整输出（模型回合结束）后自动刷新一次。
- 之后每 30 分钟定时自动刷新。
- API Key 完全留在本机：插件在宿主进程里读取凭证，通过本机 `GET /dsh-balance` 路由返回结果，浏览器端拿不到 Key。
- 自动沿用「设置 → 模型」里 DeepSeek 配置的 `apiKeyEnv` 与 `baseURL`（默认 `DEEPSEEK_API_KEY` / `https://api.deepseek.com`，也支持 `DEEPSEEK_BASE_URL` 环境变量覆盖）。

## 安装 / Install

### 推荐：dsh CLI（跨平台，官方机制）

在仓库根目录执行（`<path-to-dsh-balance>` 是本插件 checkout 的绝对路径）：

```sh
dsh plugin --profile web add <path-to-dsh-balance>
```

`dsh plugin` 会自动：把 `dsh-balance` 写入 `package.json` 的 `dependencies` 与 `dsh.profile.bundles`，并用 pnpm 安装。安装后**重启 DeepSeek Harness** 即可在侧边栏看到余额行（客户端模块只在启动时扫描包清单）。

### 手动安装（DSH Desktop）

把 `dsh-balance` 放进 web profile，并把它加入 `package.json`：

```sh
# 以 Unix / PowerShell 为例，把插件 checkout 放到 profile 下的 plugins 目录
mkdir -p "$DSH_HOME/profiles/web/plugins"
cp -R <path-to-dsh-balance> "$DSH_HOME/profiles/web/plugins/dsh-balance"
```

然后修改 `$DSH_HOME/profiles/web/package.json`，让 `dependencies` 与 `dsh.profile.bundles` 都包含它（web profile 模板默认只有 `@deepseek-ai/dsh-base` 与 `@deepseek-ai/dsh-web-app`，**不要**添加不存在的 bundle）：

```jsonc
{
  "dependencies": {
    "dsh-balance": "file:./plugins/dsh-balance"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-balance"
      ]
    }
  }
}
```

在 profile 目录执行 pnpm 安装并重启：

```sh
cd "$DSH_HOME/profiles/web"
pnpm install --offline
# 重启 DeepSeek Harness 后生效
```

> 无论哪种方式，插件集的增删都要重启 DSH 才生效（client-modules 只在启动时扫描包清单）。

## 配置 / Configuration

默认即可用；需要自定义时设置下面任意一项：

| 项 | 默认值 | 说明 |
|---|---|---|
| `apiKeyEnv`（设置 → 模型 → DeepSeek） | `DEEPSEEK_API_KEY` | 读取哪个环境变量 / 凭证引用。 |
| `baseURL`（设置 → 模型 → DeepSeek） | `https://api.deepseek.com` | DeepSeek API 根地址。 |
| `DEEPSEEK_BASE_URL`（环境变量） | 无 | 覆盖上面的 `baseURL`（优先级低于「设置」里的明确 `baseURL`）。 |

插件每次请求都会重新解析「设置 → 模型」里的 `apiKeyEnv` 与 `baseURL`，所以改完设置后**无需重启**即可在下次刷新时生效。若未配置任何 Key，侧边栏会显示「未配置 Key」。

## 卸载 / Uninstall

1. 从 `package.json` 的 `dependencies` 与 `dsh.profile.bundles` 移除 `dsh-balance`。
2. 删除 `plugins/dsh-balance`（或 `node_modules/dsh-balance`），执行 `pnpm install --offline`，重启。

## 工作原理 / How it works

- **宿主半部**（`lib/index.js`）：cordis 插件，在 `webServer` 上注册 `GET /dsh-balance`（仅回环 + 同源请求）。每次请求时解析凭证：优先读 `llm-deepseek` 设置区，其次环境变量，最后默认值；然后调用 DeepSeek `GET {baseURL}/user/balance`，把结果归一化后返回。
- **客户端半部**（`client/client.js`）：`__ModuleLoader__` bundle，向 `sidebar.footer.action` 槽注册一个 42px 的行组件，通过 `/dsh-balance` 获取余额并渲染；利用会话摘要的 `running` 状态在每次回合结束后自动刷新。
- **测试**（`tests/`）：`balance-guard.mjs`（离线、可断言，覆盖路由防护与错误映射分支）；`balance-smoke.mjs`（对真实 DeepSeek API 做端到端冒烟）。

## 开发 / Development

```sh
npm install          # 仅测试需要；插件本身无运行时依赖
npm run check        # 语法检查全部 JS
npm test             # 离线 guard 测试（无需网络 / Key）
npm run test:smoke   # 真实 API 冒烟（需要已配置 DEEPSEEK_API_KEY，会发起真实请求）
```

## License

MIT — see [LICENSE](LICENSE)
