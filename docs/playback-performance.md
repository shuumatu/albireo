# HLS 自动清晰度与本地诊断

Video.js / VHS 的自动档位使用实际分片吞吐量、缓冲与播放器显示尺寸。关闭 `useNetworkInformationApi`，避免浏览器的 `downlink` 粗估覆盖分片实测。显示尺寸按实际 DPR 放大，最高 2 倍，并保留 VHS 自身的带宽余量和正常 ABR 升降档判断；自动并不承诺始终选择最高档。

启动带宽只在当前标签页的 `sessionStorage` 中保存，键为 `albireo.playbackBandwidth.v1`。仅记录收到真实媒体字节后的测量，按媒体清单的 origin 与网络类型隔离，10 分钟失效。下一次启动使用最近测量的 80%，最高 20 Mbps。不会保存媒体路径、签名、Cookie 或账号；未命中时沿用 VHS 默认的 4,194,304 bps。关闭标签页即清除，不启用 VHS 的长期 localStorage 记忆。

网络 `change` 与离线/恢复在线事件会清除启动记忆并略过下一次可能仍来自旧请求的测量。只有网络类型、effectiveType、saveData 改变或离线/恢复在线时才重置活动估计。仅 downlink/rtt 变化不替换正在使用的实测带宽。没有 Network Information API 的浏览器仍使用在线状态事件与 10 分钟有效期；浏览器本身无法可靠区分每次 Wi-Fi 切换。

从手动返回自动时，批量解除手动档位限制，再由 ABR 决定下一档，保留现有缓冲。`vhsQualityPolicy.ts` 封装 VHS 3.17 的有限内部适配（`playlist.disabled`、`checkABR_`、100 ms 手动切换防抖）；其余版本结构不匹配时退回公开 `representations().enabled()` API。升级 Video.js / VHS 后应重跑自动切换测试。菜单显示的“自动”是用户选择，旁边的清晰度是实际已解码的画面。短视频若已全部缓存，回自动后可继续使用现有画面，无需清空缓冲立即换档。Safari 原生 HLS 仍由系统执行自动选档，不使用这套 MSE 带宽策略，手动档保留原来的单档 master 与播放位置恢复流程。

## 本地诊断

开发环境在浏览器控制台执行后刷新视频页：

```js
sessionStorage.setItem('albireo.mediaDiagnostics', '1')
location.reload()
```

读取 `window.albireoMediaDiagnostics.snapshot()`，可见最近 4 个视频会话（每个最多 120 条）的首帧耗时、重缓冲次数/时长、实测与系统带宽、缓冲秒数、实际分辨率、用户所选档位和 DPR。`sourceToFirstFrameMs` 包含用户点击播放前的等待，`playToFirstFrameMs` 从首次播放动作起算。支持 `requestVideoFrameCallback` 时以实际画面回调测量首帧，否则使用 `playing` 事件。主动暂停和跳转不计作重缓冲，进行中的等待在恢复或暂停后计入总时长。

默认不开启、不上传。生产诊断构建可临时指定 `VITE_MEDIA_DIAGNOSTICS=true`；普通生产构建忽略上述 sessionStorage 开关。诊断仅保存在内存中，不记录 URL、Cookie、请求头、签名或完整播放器对象。开发时关闭可删除 `albireo.mediaDiagnostics` 后刷新。

## 回归

```powershell
node --experimental-strip-types --test tests/playback-bandwidth.test.mjs tests/media-quality.test.mjs
$env:PLAYWRIGHT_CHANNEL='msedge'
./node_modules/.bin/playwright.cmd test tests/browser/adaptive-playback.spec.ts tests/browser/hls-playback.spec.ts --project=desktop
npm run build
```

浏览器用例用本地 FFmpeg 合成临时 HLS：低 downlink + 高速分片仍可升至 720p；DPR 3 按 2 倍选档、DPR 1 选适合小窗口的档；手动返回自动不被最后一个启用的 480p 劫持；粗估波动只清启动记忆；网络类型变化清记忆和活动估计；高带宽记忆遇到真实慢分片仍会降档。原有用例覆盖缺档禁用、同档别名、快速切档与暂停位置。设置 `FFMPEG_PATH` 指向可执行文件，或使用已有 JavaCPP GPL 缓存；找不到 FFmpeg 时合成媒体测试会标记跳过。
