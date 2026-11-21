# 碳速算平台

面向电子信息制造企业的财务驱动碳核算平台。覆盖票据采集与复核、企业排放核算、BOM产品足迹、减排模拟、供应链协同与审计证据导出。

**在线入口：https://carbon.yjr-adc-demo.xyz**
源码同步日期：2026-11-22。公网和本机的密码分别保存在项目根目录的 `云端账号_勿公开.txt`、`本机账号_勿公开.txt`；均不进入源码包。

## 使用与交付

- [上线与启动说明](上线与启动说明.md)：首次使用、Windows本机启动、Linux运维、备份恢复。
- [企业运营版产品说明与使用手册](docs/碳速算_企业运营版产品说明与使用手册.docx)：服务对象、岗位、完整业务流程及面板索引。
- [功能与实现对照](功能与实现对照.md)：六个模块、项目特色、实现边界。
- [测试报告](测试报告.md)：148项自动检查、63项云端业务验收、浏览器实测及恢复证明。
- [因子数据来源与核算边界](docs/因子数据来源与核算边界.md)：CEADs原始数据、映射与单位、CO₂和CO₂e区别。
- [SER训练与验收](docs/SER训练与验收.md)：可选自有票据训练、评估与上线流程。

## 技术与部署

React 19、TypeScript、Vite 8、Ant Design 6、ECharts；FastAPI、SQLAlchemy；PostgreSQL 18.3、Redis 7；Docker Compose、Caddy自动HTTPS。前端构建后由后端同源提供。OCR使用RapidOCR，物料语义匹配使用BGE中文嵌入，财务数值勾稽接入DeepSeek。生产单进程配合限流部署在已有云主机上，数据库与文件卷独立于牙科系统。

```text
app/                 API、认证、业务服务、AI适配、数据模型
algorithm_pkg/       Scope核算、EIO-LCA、PCF、减排情景算法
frontend/            页面源码与构建配置
data/io/             MRIO聚合表、CEADs部门映射、强度向量与溯源元数据
migrations/          数据库迁移
tests/               API、企业隔离、票据/PDF与导出检查
docs/                核算边界、模型训练、验收证据
scripts/             独立本机配置与启动脚本
deploy/              服务器维护、Caddy站点和备份定时任务
compose.local.yml    隔离的本机环境，入口127.0.0.1:18083
deploy.compose.cohost.yml  现有服务器部署配置
```

## 本机快速启动

当前电脑双击 `启动本机平台.cmd`。也可在Ubuntu WSL中进入此目录执行：

```bash
python3 scripts/start_local.py
```

脚本需要能访问Docker；本电脑的启动器会使用已安装的Ubuntu-22.04和root运行Docker。首次创建私密配置，之后保留配置和数据库。新电脑需安装Docker；不存在预构建镜像时Compose按Dockerfile构建，需下载依赖。正式步骤见启动说明。

## 结果的适用范围

已接通的主流程使用真实OCR、BGE与DeepSeek。自有票据SER训练、商业发票查验、支付收款及第三方核证不属于当前已验证外部服务。42部门EEIO研究因子只覆盖本平台三类采购估算；它们不是官方Scope 3发布因子。当前未覆盖Scope 3全部15类，不应宣称完整生命周期认证。报告与哈希证据供复核使用，不能替代独立核证或官方申报。
