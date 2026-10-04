# Git 凭据保护

真实数据库密码、API Key、JWT 私钥和服务令牌放在仓库外，或由部署环境注入。模板只写变量名和明确的占位值。

本项目提供 Gitleaks 默认规则，以及数据库密码、嵌套 YAML API Key 和 Spring 密钥默认值规则。扫描输出会隐藏凭据。

## 本机启用

先安装 Gitleaks 到 PATH；Windows 也支持 `$HOME/.local/bin/gitleaks.exe`。然后在项目目录运行：

```powershell
./scripts/Install-GitSecurity.ps1
```

也可以运行 `git config --local core.hooksPath .githooks`。每个新克隆都需要启用一次。

提交前扫描暂存区并阻止本机 `.env`、密钥库和数据库 IDE 配置。推送前扫描将推送的分支／标签的全部可达历史。工具缺失或扫描出错时会阻止操作。

```bash
bash scripts/check-secrets.sh staged
bash scripts/check-secrets.sh history HEAD
```

GitHub 的 `Secret scan` 工作流执行相同检查；建议把它设为保护分支的必需检查。CI 在上传之后执行，本机钩子负责上传前拦截。不要使用 `--no-verify` 绕过检查。

## 配置文件

`.env`、`.env.*` 默认忽略，仅允许提交 `.example`、`.sample`、`.template` 模板。Vite 的 `VITE_*` 会进入浏览器资源，只能存放公开配置。后端本机凭据使用 `$HOME/.config/shuumatu/`，不要复制回项目。

`.gitignore` 不会自动取消已经跟踪的文件，也不会清除旧提交。已泄露凭据需要撤销／轮换，随后清理 Git 历史；旧克隆和服务端缓存需要另外处理。
