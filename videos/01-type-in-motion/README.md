# 01 · TYPE IN MOTION + 剪映开场

第一期成片：一段 30 秒的原创文字卡点动画《TYPE IN MOTION》（120 BPM，电光蓝 + 荧光黄），开场伪装成在剪映里剪辑，播放后画面放大铺满全屏，无缝接入正片。

- 发布版：`output/jianying_making_of.mp4`（34.1s）
- 纯正片：`output/type_in_motion.mp4`（30s）
- 复刻提示词：仓库根目录 `PROMPT_复刻提示词.md`

## 目录
| 路径 | 内容 |
|---|---|
| `film/` | 正片：`motion.js` 动效、`score.py` 配乐、`render.mjs` 逐帧渲染（16 子帧运动模糊） |
| `intro/` | 剪映风格开场：`app.js` 界面与操作编排、`foley.py` 点击/搓碟音效、`wave.js` 音频轨波形 |
| `output/` | 成片（提交到仓库） |
| `out/` | 中间文件（不提交，可随时删除重建） |

## 构建
```bash
./build.sh
```
一键从零生成两个成片：正片 → 抽帧 → 开场 → 拼接。
