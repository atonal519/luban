# 鲁班 LUBAN · 本地开发版

这是当前鲁班前端的空数据交付版本，供本地继续开发和接入 NocoBase。需求池、月度 RAT、人力资源池、FE 清单、版本管理及现有业务流转代码均保留。旧业务记录、人员名单、源表、附件和报表已移除。

## 本地启动

需要 Node.js 22 或更新版本、npm。

```bash
npm ci
npm run dev
```

打开 <http://127.0.0.1:4331/fe-board/#demand>。`dev` 会先构建再启动本地预览；修改源码后重新运行即可。

也可以分开执行：

```bash
npm run build
npm run preview
```

默认仅监听本机。可通过 `LUBAN_PORT` 调整端口，通过 `LUBAN_HOST` 调整监听地址。

## 重新录入数据

可以直接在页面新增需求、RAT 工作或 FE，保存到当前浏览器。同一浏览器内再次打开可继续使用；清除站点数据会清除这些本地录入。

如需从底表重新整理初始数据，在本地创建 `data/local.json`，结构参照 `data/empty.json`。构建时优先使用它；也可用 `LUBAN_DATA_FILE` 指定其他 JSON 文件。每套独立数据使用不同的 `id`，避免沿用其他数据的浏览器缓存。

月度 RAT 底表经解析后可放入数据的 `ratSource` 字段。原始工作簿整理工具保留在 `tools/build-data.py`，输入是已解析的源表 JSON；它不是直接上传 Excel 的通用导入器。源表格式和字段需在本地结合实际表格核对。

真实数据、附件与本地连接配置不要提交到公开仓库。`data/local.json`、`data/private/`、`.env*`、`dist/` 和数据库文件已被 Git 忽略。

## 代码入口

| 路径 | 用途 |
| --- | --- |
| `src/fe-board/` | 完整前端、页面与业务逻辑 |
| `src/fe-board/intake/` | 需求、RAT、人力统计及关联 FE |
| `src/fe-board/workflow-model.js` | FE 阶段流转 |
| `src/fe-board/pm-directory.js` | PM 默认建议配置，当前名单为空 |
| `src/fe-board/intake/resource-ui.js` | 模块分组与 TL 展示配置，当前名单为空 |
| `data/empty.json` | 默认空数据结构 |
| `build.mjs` | 构建可运行的静态页面到 `dist/` |
| `qa/` | 使用虚构数据的业务模型验证 |

模型验证需要 Python 3 与 Node.js：

```bash
python3 -m unittest discover -s qa -p 'test_*.py'
```

## 当前边界

本版沿用浏览器本地保存和演示角色切换。真实多人身份、服务端持久化、钉钉对接及 NocoBase 后端尚需后续接入；月度 RAT 正式封板与不可变留档也尚未完整实现。GitHub 托管源代码，本身不承载业务数据库。

后续使用 NocoBase 时，在本地配置该环境的地址和认证。不要将账户、密码、访问令牌或内部地址写入公开代码。
