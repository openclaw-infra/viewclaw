# viewClaw Server 部署（Bun + Elysia）

## 1) 服务器安装 Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

## 2) 上传项目并安装依赖

```bash
cd viewClaw/server
bun install
```

## 3) 启动

```bash
cp .env.example .env
bun run start
```

## 4) 反向代理（可选）
建议用 Nginx/Caddy 暴露 HTTPS，再让 Expo 使用该 API BaseURL。

## 5) 移动端连接
在 Expo App 的 Settings 中填入：

`https://your-api-domain.com`

保存后会持久化，下次自动使用。
