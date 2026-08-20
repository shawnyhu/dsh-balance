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

### DSH Desktop（推荐）

把 `dsh-balance` 目录放进 web profile：

```powershell
$web = "$env:DSH_HOME\profiles\web"
Copy-Item -Recurse .\dsh-balance $web\plugins\dsh-balance
```

然后修改 `$web\package.json`：

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
        "dshmarket",
        "dsh-balance"
      ]
    }
  }
}
```

在 profile 目录执行 pnpm 链接并重启 DSH：

```powershell
Set-Location $web
& "$env:DSH_HOME\.desktop-bin\pnpm.cmd" install --offline
# 重启 DeepSeek Harness 后生效（新插件只在启动时扫描）
```

> 插件集的增删必须重启才生效（client-modules 只在启动时扫描包清单）。

### dsh CLI（源码安装）

```sh
dsh plugin --profile web add <path-to-dsh-balance>
```

## 卸载 / Uninstall

1. 从 `package.json` 的 `dependencies` 与 `dsh.profile.bundles` 移除 `dsh-balance`。
2. 删除 `plugins\dsh-balance` 目录，执行 `pnpm install --offline`，重启。

## 工作原理 / How it works

- **宿主半部**（`lib/index.js`）：cordis 插件，在 `webServer` 上注册 `GET /dsh-balance`（仅回环 + 同源请求）。每次请求时解析凭证：优先读 `llm-deepseek` 设置区，其次环境变量，最后默认值；然后调用 DeepSeek `GET {baseURL}/user/balance`，把结果归一化后返回。
- **客户端半部**（`client/client.js`）：`__ModuleLoader__` bundle，向 `sidebar.footer.action` 槽注册一个 42px 的行组件，通过 `/dsh-balance` 获取余额并渲染；利用会话摘要的 `running` 状态在每次回合结束后自动刷新。
- **测试**（`tests/`）：`balance-smoke.mjs` 对真实 DeepSeek API 做端到端冒烟；`balance-guard.mjs` 覆盖路由防护分支（回环、Origin、方法、缺 Key）。

## License

MIT — see [LICENSE](LICENSE)
