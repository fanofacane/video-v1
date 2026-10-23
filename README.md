# video-v1

用代码从零生成的动态视频：画面是 HTML/Canvas 动效，用 Playwright 逐帧渲染；音乐用 numpy 合成；最后用 ffmpeg 合成成片。不使用外部视频、图片素材或版权音乐。

## 仓库结构
```
video-v1/
├── README.md                  本文件：结构与约定
├── PROMPT_复刻提示词.md        第一期成片的复刻提示词
├── PROMPT_ORBIT.md            第二期成片的提示词
└── videos/                    每支视频一个文件夹
    ├── 01-type-in-motion/     第一期：TYPE IN MOTION + 剪映开场
    │   ├── README.md          这支视频是什么、怎么构建
    │   ├── build.sh           一键从零构建
    │   ├── film/  intro/      源码（按视频的组成部分划分）
    │   ├── output/            成片（提交）
    │   └── out/               中间文件（不提交）
    └── 02-orbit/              第二期：ORBIT，从一个光点到银河再回到光点
```

## 新做一支视频的约定
1. 在 `videos/` 下新建 `NN-英文短名/`，编号顺延，例如 `videos/02-word-acts/`。**不要在根目录新建文件夹。**
2. 文件夹内必须有：
   - `README.md`：一句话简介 + 目录说明；
   - `build.sh`：从零到成片的完整命令。
3. 源码按组成部分分子目录（如 `film/`、`intro/`），字体放在用到它的子目录的 `fonts/` 里。
4. 中间产物统一写到该视频的 `out/`，已被 `.gitignore` 忽略。
5. 成片放 `output/` 并提交，文件名用英文。
6. 这支视频的提示词放根目录，命名为 `PROMPT_<视频名>.md`。

## 环境
- Node + Playwright（Chromium）
- Python 3 + numpy
- ffmpeg
