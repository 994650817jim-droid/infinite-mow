# 连战军团与天门 A/B 实验

本目录是本地 QA 工具。实验只在隔离的 Chrome 上下文中运行，不修改游戏源码、双人经济、正式奖励或个人存档。需要游戏仓库原有的 Playwright、可启动的 Chrome，以及在本机运行的 Vite 开发服。

## 复跑

在游戏仓库根目录打开 PowerShell，先另启本机 Vite。以下命令使用 5286 端口。建议指定独立的新证据目录，避免覆盖上一轮同名实验。

```powershell
$repo = (Get-Location).Path
$tools = Join-Path $repo 'tools/gauntlet-army-experiment'
$env:GAUNTLET_ARMY_EVIDENCE = Join-Path $repo 'output/army-new'
$base = 'http://127.0.0.1:5286'
node "$tools/history.mjs"
node "$tools/check-rewards.mjs" $repo $base
node "$tools/freeze-history.mjs" $repo $base
$gate = Join-Path $env:GAUNTLET_ARMY_EVIDENCE 'historic-gate-fixture.json'
node "$tools/run.mjs" $repo zhangfei 177 weapon alternate zhangfei-177 $base
node "$tools/run.mjs" $repo zhaoyun 63951 agility reverse zhaoyun-63951 $base
node "$tools/run.mjs" $repo zhangfei 177 weapon guard gate-A-guard $base 0 $gate A
node "$tools/run.mjs" $repo zhangfei 177 weapon guard gate-B-star $base 0 $gate star
node "$tools/run.mjs" $repo zhangfei 177 weapon guard gate-B-troops $base 0 $gate troops
node "$tools/run.mjs" $repo zhangfei 177 weapon sortie gate-A-sortie $base 0 $gate A
node "$tools/run.mjs" $repo zhangfei 177 weapon guard late-troop-cohort $base 1200 $gate A cohort
$env:GAUNTLET_ARMY_ROUTE = 'extreme'
node "$tools/run.mjs" $repo huangzhong 91173 weapon guard huangzhong-91173-extreme $base
Remove-Item Env:GAUNTLET_ARMY_ROUTE
node "$tools/analyze.mjs"
node "$tools/pool.mjs"
node "$tools/compare.mjs"
```

`sample-baseline.json` 保存对账及冻结夹具所需的旧张飞自然通关记录字段，并列出原始完整 JSON 的 SHA-256。有完整旧证据时，可用 `GAUNTLET_ARMY_HISTORY` 指定它。起点资料缺失的部分在 `historic-gate-fixture.json` 的 `provenance` 中列出。

## 参数与读数

`run.mjs` 的位置参数顺序为游戏仓库、武将、种子、选卡策略、军令策略、样本目录名、开发服地址、终止观察的绝对战斗秒、天门快照路径、干预分支、兵种夹具。终止秒设为 0 时，持续到自然战败或完整结算。

选卡策略为 `weapon`、`agility` 或 `command`。军令策略为 `guard`、`sortie`、`alternate` 或 `reverse`。同时运行的性能专项可在证据根目录建立 `PAUSE`，再等所有进行中样本的 `paused.json`，测完删除 `PAUSE` 即恢复。

天门快照只用于标准十五阵过门后的实验。A 直接晋级，B 的 `star`、`weapon`、`troops` 表示优先从原生面板选择哪一项。达到上限的本命和不合法的星不会出现在面板。相应 B 项不可用时顺延到合法星或第一项，实际选择见 `reward.json`。`cohort` 是单独的兵种夹具，固定投放天门档五种兵各三名，不能并入自然招兵或天门奖励样本。黄忠样本在隔离存档中满足长沙放过黄忠的正式解锁条件，从一级和零部曲进入极限挑战。

读数、受击归因、存活删失与控变量边界见 [测量方法](METHOD.md)。渲染在正式更新循环之外省略，只可使用产出的战斗数据。真实输入与帧序会令重复实验出现差异。
