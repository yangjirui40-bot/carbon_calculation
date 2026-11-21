# 碳速算前端

React 19、TypeScript、Vite 8、Ant Design 6、ECharts。前端使用后端接口，不维护另一套核算公式。

## 推荐使用方式

按仓库根目录 [上线与启动说明](../上线与启动说明.md) 启动完整Docker环境，打开http://127.0.0.1:18083。公网为https://carbon.yjr-adc-demo.xyz。账号查看根目录单独的私密文件；这里不提供公网默认密码。

## 修改与构建

需要Node 24及npm。在此目录运行npm ci，然后npm run build；产物dist由后端同源托管。npm run lint执行静态检查。Dockerfile会自动构建前端。前端变量不得包含DeepSeek或数据库密钥。

单独开发Vite时，现有vite.config.ts代理目标是localhost:8000，适用于自行运行该端口的后端。若使用新的本机Docker后端，应将三个代理目标改为http://127.0.0.1:18083，在frontend/.env.local中设置VITE_API_BASE_URL=空值，再运行npm run dev；浏览器请求通过Vite同源代理到后端。不要复制旧模板中的localhost:8000覆盖成不匹配的端口。

## 接口与页面

/api/v1统一前缀；登录使用表单，后续用Bearer Token。会话保存为localStorage.carbonspeed.session，企业选择为carbonspeed.companyId。界面权限用于导航，后端仍独立检查用户与企业归属。

原图复核使用受保护的图片接口和内存Blob，不在图片URL携带Token；已入账页面保留原图和只读复核字段。移动端导航可展开，单据页控件随宽度换行。

业务页面包括工作台、驾驶舱、单据/记录/因子、企业核算与EEIO、产品/BOM、报告、减排模拟、供应链及供应商、配额、审计、订阅和管理后台。未配置的外部发票验真、未训练的SER、缺失供应商信息均需保留真实状态，不把演示结果改成真实核证结果。
