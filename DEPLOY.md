# Wallhaven Downloader 部署指南

本程序由 Node.js 后端和 React 前端组成。为了方便部署，后端已经集成了静态托管功能，您可以将前端打包后由后端统一提供服务。

## 1. 准备工作

确保您的服务器已安装：
- **Node.js** (推荐 v18+)
- **npm** 或 **yarn**
- **PM2** (用于进程守护，推荐) `npm install -g pm2`

## 2. 编译前端

在本地或服务器的前端目录下执行编译：

```bash
cd frontend
npm install
npm run build
```

编译完成后，会生成 `frontend/dist` 文件夹。

## 3. 配置后端

进入后端目录，配置环境变量：

```bash
cd backend
npm install
```

修改或创建 `.env` 文件：

```env
PORT=5000
JWT_SECRET=您的随机密钥
ADMIN_PASSWORD=您的登录密码
DOWNLOAD_DIR=/var/data/wallpapers  # 图片存储路径
DEFAULT_PROXY=http://127.0.0.1:7890 # 默认代理(可选)
```

## 4. 启动服务

### 使用 PM2 启动（推荐）

在 `backend` 目录下：

```bash
pm2 start index.js --name wallhaven-down
pm2 save
```

### 直接启动

```bash
npm start
```

## 5. 访问与维护

- **访问地址**：`http://您的服务器IP:5000`
- **Nginx 反向代理（可选）**：
  如果您想使用域名或 80 端口，可以配置 Nginx：

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 500m; # 支持大文件打包下载
    }
}
```

## 常见问题

1. **页面空白**：确保 `frontend/dist` 文件夹存在，且与 `backend` 目录层级正确（`backend` 的上一级应能找到 `frontend/dist`）。
2. **下载失败**：请检查服务器是否能正常访问 `wallhaven.cc`，必要时在 `.env` 中配置 `DEFAULT_PROXY`。
3. **权限问题**：确保运行 Node.js 的用户对 `DOWNLOAD_DIR` 有读写权限。
