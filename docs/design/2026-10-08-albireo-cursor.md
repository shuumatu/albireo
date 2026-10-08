# Albireo 星仪罗盘指针

展示端通过 App.vue 挂载 AlbireoCursor.vue。当前实现使用真实 CSS PNG 图片光标，由浏览器直接移动；没有第二层跟随鼠标的 Canvas，也不再用透明系统光标叠加装饰。

- 保留金蓝双星、中心点击点和细窄 I 形文本状态；图片缩放使用带加减标记的 Albireo 形态。
- 默认、悬停、文本、精确定位、后台运行、忙碌、移动、缩放、禁用根据控件语义和原 CSS cursor 自动切换。
- albireoCursorStyles.ts 以独立属性保留原有 CSS 语义，避免读取当前图片光标时误判；不改写控件 inline cursor。
- albireoCursorImages.ts 从原绘图生成 32 CSS px PNG，先解码再替换；60 帧循环、每秒 15 帧，最多缓存 512 张。减少动态效果时固定为第 0 帧。
- 指针图片在页面边缘裁剪，并同步调整热点，避免 Chromium 因图片超出视口而拒绝自定义光标。
- 鼠标会话期间持续安装图片光标；按下、松开、失焦和 pointercancel 不再撤掉主题。图片/链接的隐式 HTML 拖放会阻止，以免轻微移动触发 OS 拖放图标；显式 draggable 控件保持其行为。
- albireoScrollbars.ts 为页面和原生滚动容器安装 DOM 滑块，隐藏对应原生滚动条。滑块通过 pointer capture 调整原元素 scrollTop/scrollLeft，保留滚轮、触摸、键盘、浏览器滚动恢复。已有刻意隐藏滚动条的时间线和 NScrollbar 不重复添加。
- 滚动条有 scrollbar 角色、方向、当前值、控制目标，并支持方向键、Home/End 和 PageUp/PageDown。脱离页面、触屏、强制对比色或卸载时恢复原滚动条。
- 页面内选择框、媒体控件、图片缩放沿用主题；已有 cursor:none（例如播放器自动隐藏）仍然隐藏。显式 data-albireo-cursor="native" 为局部退出接口。
- 浏览器工具栏、原生弹出菜单、文件对话框及其他页面外的系统界面不由网页 CSS 控制。指针锁定和强制对比色遵循浏览器原生行为。

## 调研依据

[Chromium EventHandler 源码](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/input/event_handler.cc) 的 SelectCursor 对非自定义原生滚动条直接返回 PointerCursor；HandleMouseMoveEvent 在滚动条按下期间将移动事件交给滚动条，不继续普通页面事件派发。仅隐藏系统光标并使用跟随 Canvas 无法可靠覆盖此路径。

[MDN cursor](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor) 描述 PNG 光标、热点坐标和视口边界限制。[MDN setPointerCapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture) 说明 DOM 控件拖出边界后保留指针事件的机制。

## 验证

运行 npm run build 和 PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/browser/albireo-cursor.spec.ts tests/browser/albireo-cursor-video.spec.ts。

测试关闭 headless Chrome 默认隐藏滚动条的参数；检查 PNG 非透明像素、热点和边界、真实点击各事件阶段、:active/:focus 优先级、图片轻微拖动、输入选择、原生 range、横纵滚动条拖动与键盘、触屏及减少动态效果。Video.js 使用本地生成的 HLS 音视频验证真实进度/音量变化，需 FFMPEG_PATH 或本地 JavaCPP FFmpeg。

自动化验证的是浏览器实际交互、图片资源与最终样式，未将 DOM 截图当作 Windows 系统光标逐帧录像。
