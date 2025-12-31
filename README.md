# Wallhaven Downloader (React 版)

一个基于 React 和 Node.js 开发的 Wallhaven 壁纸批量下载工具。本项目不仅完美复刻了原 Shell 脚本的所有配置能力，还提供了现代化的 Web 交互界面、下载历史管理和生产环境部署支持。

## ✨ 功能特性

- **完整配置支持**：支持 Wallhaven 的所有搜索参数，包括分类筛选、分辨率、宽高比、收藏数过滤、排序模式等。
- **现代化 UI**：基于 Ant Design 设计，支持**深色/浅色模式**自动切换，页面响应式适配。
- **认证管理**：集成密码登录认证，保护您的服务器资源安全。
- **下载管理**：
  - 下载壁纸到部署服务器。
  - **预览已下载内容**：支持在网页端直接浏览已下载的图片墙。
  - **打包下载**：支持将下载的壁纸打包为 ZIP 文件并下载到本地电脑。
  - **删除历史**：支持在界面上直接管理和清理服务器上的下载目录。
- **网络优化**：内置对 **HTTP/HTTPS/SOCKS5 代理**的支持，解决 Wallhaven 访问受限问题。
- **自动保存**：表单配置实时持久化，刷新页面不再丢失已填写的参数。
- **生产环境适配**：后端集成前端静态托管，支持单进程快速部署。

## 🚀 快速开始

### 本地开发

1. **克隆项目**
   ```bash
   git clone <您的项目地址>
   cd wallhaven_down
   ```

2. **后端启动**
   ```bash
   cd backend
   npm install
   # 修改 .env 文件配置您的密码和端口
   npm start
   ```

3. **前端启动**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### 生产部署

请参考详细的 [部署指南 (DEPLOY.md)](./DEPLOY.md)。

## 🛠️ 技术栈

- **前端**：React 19, Vite, Ant Design, Axios, React Router
- **后端**：Node.js, Express, fs-extra, adm-zip, jsonwebtoken
- **网络**：https-proxy-agent, socks-proxy-agent

## 📝 环境变量 (.env)

| 变量名 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `PORT` | 后端服务端口 | `5000` |
| `JWT_SECRET` | JWT 认证密钥 | `wallhaven_secret_key` |
| `ADMIN_PASSWORD` | 登录密码 | `admin123` |
| `DOWNLOAD_DIR` | 图片存储绝对路径 | `./downloads` |
| `DEFAULT_PROXY` | 默认代理地址 | `(空)` |

## 🤝 贡献建议

欢迎提交 Issue 或 Pull Request 来改进本项目。

## 📜 许可证

ISC License
