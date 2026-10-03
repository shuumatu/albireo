# 照片浏览优化

## 交互依据

- [PhotoSwipe](https://photoswipe.com/options/)：使用成熟的缩放、平移、双指手势、下滑关闭与缩略图展开动画。
- [W3C Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)：背景不可交互、键盘焦点限制、Escape 关闭、退出恢复入口焦点。
- [PhotoSwipe zoom](https://photoswipe.com/adjusting-zoom-level/)：适应屏幕与原始尺寸分开，缩放不超过合理上限。

## 修改范围与计划

1. 移除详情页画面内的「查看原图」标记，整张照片作为语义化按钮，画面外给出简短操作提示。
2. 抽离 PhotoViewer，按需加载 PhotoSwipe，点击后立即展示当前预览，后台解码原图；升级清晰度时保持缩放与位置。
3. 顶部保留标题、信息与关闭，底部提供缩放、比例、适应屏幕及原始尺寸。信息抽屉展示拍摄信息与快捷键。
4. 支持滚轮缩放、放大后拖动、双击缩放、双指缩放、下滑关闭；工具栏可收起，保留退出入口。
5. 提供加载、超时、失败、重试和预览降级反馈；关闭或路由卸载时清理请求、监听器、滚动锁与背景 inert。
6. 优化触屏安全区、窄屏与横屏，尊重 prefers-reduced-motion。
7. 类型检查与生产构建；桌面/手机浏览器验证开关、缩放、拖拽、键盘、原图失败重试、退出恢复和慢速加载。

本次专注单张作品的详细浏览；相似作品仍沿用现有导航，不将推荐结果冒充连续相册。

## 实现结果

- `ImageDetail.vue`：移除画面内按钮，补充图外提示、图片淡入、加载反馈，以及 display / medium / original 的依次降级。
- `PhotoViewer.vue`：独立浏览组件，PhotoSwipe 核心按点击动态导入；从实际照片边界展开，关闭时回到入口。中性深色背景保持照片色彩。
- 原图解码完成后再替换预览，保留缩放和位置；手势和动画进行中延后替换。25 秒超时后保留预览并允许重试，关闭即取消待处理加载。
- 工具栏支持缩放比例、适应屏幕、1:1、收起/恢复。信息面板在桌面使用侧面抽屉，在手机使用底部面板，并分别显示键盘与触屏说明。
- 滚动锁恢复原有样式，背景设为 inert，Tab / Shift+Tab 保持在浏览器内部，退出恢复照片入口焦点；路由卸载即清除弹层。
- 信息面板滚动不会缩放照片；适配窄屏、横屏、安全区与系统减少动画偏好。

## 验证与复现

2026-10-03 最终结果：`yarn build` 通过；浏览器回归 30 项通过，3 项按输入设备类型跳过，退出码 0。已目视检查桌面、手机、信息面板和竖图截图。构建仍有既有地图与视频分包超过 500 kB 的提示。

执行 `yarn build` 检查 Vue / TypeScript 并构建生产资源。

先执行 `yarn exec playwright install chromium --only-shell` 安装配套测试浏览器，再执行 `yarn test:photo-viewer` 运行 Playwright 回归。测试使用 5181 端口的隔离示例服务，不向业务后端发送请求。可通过 `PLAYWRIGHT_CHANNEL=chrome` 显式改用本机 Chrome。

测试服务器由 `tests/browser/setup.ts` 在进程内启动并通过 Vite API 关闭，避免 Windows 下 `taskkill` 退出测试服务器时停滞。

本机 C 盘空间不足时，可在项目根目录的 PowerShell 中使用以下缓存设置，再执行安装和测试命令（只影响当前进程）：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\node_modules\.cache\playwright"
$env:TEMP = "$PWD\node_modules\.cache\playwright-tmp"
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
yarn exec playwright install chromium --only-shell
yarn test:photo-viewer
```

覆盖桌面 Chrome、Pixel 7 触屏模拟、减少动画三组配置：打开/关闭、滚轮/拖拽/双击、双指缩放/双击/下滑关闭、焦点循环与恢复、滚动位置、原图失败与超时、重试、慢加载中关闭、高清替换保持位置、路由离开时清理、信息面板滚动，以及竖图/320px 窄屏/横屏布局。生成的截图与失败追踪放在忽略的 `test-results/` 中。

范围限制：触屏在 Chromium 模拟器验证，未执行实体 iPhone / Safari 设备验收；签名原图地址与真实存储服务连通性仍取决于后端返回。

## HEIC / HEIF 兼容修复

详情 API 的 `imageUrl` 是上传源文件，`displayUrl` 是后端 `original` 档生成的全尺寸 JPEG（不缩放，JPEG quality 0.95），`mediumUrl` 才是缩小的预览。HEIC / HEIF 浏览应使用 `displayUrl`，不能把成功显示的全尺寸 JPEG 又替换成浏览器可能无法解码的 HEIC。

前端按源文件 MIME、文件名或源 URL 识别 HEIC / HEIF（包括大写后缀、签名查询参数和 sequence MIME），优先使用全尺寸 JPEG；标记「高清兼容图已就绪」，支持 1:1，并保留源文件。普通 JPEG/WebP 等格式仍保留原来的源文件浏览行为。全尺寸 JPEG 不可用时保留 medium 预览、允许重试，不将缩小预览误标为原尺寸。

该修复复用现有后端转换结果，不需要重新上传或添加浏览器 HEIC 解码器。若旧数据缺少已生成的 `displayUrl`，需要从管理端重新处理以补齐 JPEG，前端不会猜测存储地址。JPEG 是兼容副本，并不等同于 HEIC 源文件的编码、HDR 或全部元数据。

修复验证：生产构建通过；桌面、移动模拟和减少动画模式共 15 项定向浏览器回归通过，覆盖 HEIC/HEIF 识别、兼容图 1:1、不请求 HEIC 源文件、兼容图失败重试、普通原图浏览以及高清替换不跳动。
