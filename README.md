# 店小智 Dianxiaozhi

为学校周边便利店、小卖部等小型门店设计的经营工作台。通过商品和业务记录连接库存、财务、经营建议及执行复盘。

当前版本 **v0.6.2 答辩测试部署版**：保留本机账本、库存盘点、简化三表、导入和执行复盘，新增邀请码会话、28 天测试配置及服务端 GLM-4-Flash 接入。默认仍为本地规则问答；主动同意后才发送本次问题与裁剪后的经营汇总。已部署 CloudBase 上海体验环境，公网接口与真实 GLM 模拟数据调用通过；实际账本迁移和手机全流程仍待验收。

## 本地运行

需要 Node.js 22 或更新版本，无需安装 npm 运行依赖。

```sh
cd app
npm start
```

访问 `http://127.0.0.1:19393`。Windows 也可运行 `app/start.cmd`。

默认进入空白的“我的门店”，可主动切换到明确标记的演示数据。两种模式独立保存，不会自动同步到云端。模型 Key 只在服务端环境变量中配置，前端不接收密钥。

## 验证

```sh
cd app
npm test
```

具体数据口径、使用说明和已知范围见 [app/README.md](app/README.md)。

- [备份迁移与一致性核验](docs/backup-migration.md)
- [CloudBase 部署验收记录](docs/cloud-demo-validation.md)
- [CloudBase 答辩测试部署指南](docs/cloudbase-deploy.md)
- [手机本地部署与验收说明](docs/local-deployment.md)
- [已完成内容与后续优先级](docs/progress.md)
- [本地电脑功能验收及缺项](docs/pc-acceptance.md)
- [v0.6 库存盘点设计与口径](docs/stocktake-plan.md)
- [第二阶段设计与范围](docs/phase-two.md)
- [第二阶段验收记录](docs/phase-two-validation.md)
- [前端设计技能来源与检查](docs/skill-review.md)

此仓库只包含项目源码和开发资料，经营数据、聊天记录、导入文件及备份不进入 Git。

Key 由用户在 CloudBase 配置，源码和部署包不含真实密钥；真实门店效果需实地试用，开发演示和本地协议测试不代表商业验证。当前数据仍只存在本机浏览器，GitHub仓库不提供云端同步。
