# 给 ChatGPT 看的艾布拉姆斯网站

这是 `abrams-evolution` 的一份完整副本，专门为"让 AI 看到整站（含交互）"准备。
站点本身零依赖、无构建，整个文件夹原样上传即可运行。

## 三种给 ChatGPT 的方式

### 1. 给一个公网地址（最完整）

ChatGPT 的浏览工具**打不开 localhost**，所以必须先部署。任意静态托管都行（GitHub Pages /
Cloudflare Pages / Netlify），把本文件夹上传，拿到 `https://…` 地址。

然后用 URL 参数把任意交互状态直接喂给它：

| 想让它看的 | 发给它的地址 |
| --- | --- |
| 首页（磨砂实物背景 + 界面） | `https://你的域名/` |
| 某个型号 | `https://你的域名/#/m1a1` |
| 某个部件的数据卡（不用悬停） | `https://你的域名/?part=gun#/m1a1` |
| 纯照片模式 | `https://你的域名/?mode=photo#/m1a1` |
| 机器可读的全量数据 | `https://你的域名/?dump=1` |
| 配准调试层 | `https://你的域名/?debug=1#/m1` |

部件 key：`gun` `turret` `cupola` `hull` `engine` `suspension` `track`，
SEPv2 另有两个 `era`（爆炸反应装甲）`rws`（遥控武器站）。

带浏览器/计算机操作能力的 AI（ChatGPT 的 agent 模式、Playwright 类工具）可以直接
在上面点牌匾切照片模式、Tab 到部件看卡片、用方向键切型号——每个部件都是可聚焦元素，
自带 `aria-label` 数据摘要。

### 2. 直接喂文本（任何能读文件的模型）

- `llms.txt`：七型号的简介、与前型对比、每个部件的数据，纯 Markdown。
- `content.json`：同样的内容，结构化 JSON。

把这两个文件里的文字直接贴进对话即可，不需要联网。

### 3. 发截图（多模态但不上网的模型）

`screenshots/` 里有 65 张，覆盖：

- 7 个型号的默认视图（`<型号>-default.jpg`）
- 7 个型号的纯照片模式（`<型号>-photo.jpg`）
- 每个型号的每个部件卡片（`<型号>-part-<部件>.jpg`）

`screenshots/index.html` 是个本地画廊，双击就能翻。

## 本地预览

```bat
start.bat
```

或 `python -m http.server 8000`，然后开 http://127.0.0.1:8000/ 。

> `file://` 不行：ES Modules 和 fetch 都会被浏览器拦掉。

## 目录

```
abrams-for-chatgpt/
├─ index.html / styles.css / js/ / assets/   站点本体
├─ start.bat / serve.py                      本地预览
├─ llms.txt                                  AI 优先读的摘要
├─ content.json                              机器可读数据
├─ screenshots/                              65 张状态截图 + 画廊
└─ SITE-README.md                            原技术文档
```

## 注意

- 默认进站是磨砂实物背景；点标题右侧的「真实图片」牌匾进纯照片模式，再点或 Esc 返回。
- 照片版权：DVIDS 两张是公有领域；另外几张请自行确认后再公开。
