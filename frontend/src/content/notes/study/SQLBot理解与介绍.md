---
title: "SQLBot：用一句话问数据库要数据"
summary: "DataEase 出品的智能问数系统（ChatBI），基于大模型 + RAG，自然语言提问自动生成 SQL 并出图表。一条 Docker 命令本地跑起来，实测上手门槛、追问体验和几个要注意的坑。"
category: "study"
date: 2026-10-23
tags: ["SQLBot", "ChatBI", "AI", "数据分析", "RAG"]
cover: "/illustrations/sqlbot.jpg"
---

# SQLBot：用一句话问数据库要数据

## 前言

作为后端或数据分析，最常被问到的一句话是："帮我查一下上个月的销售数据"。以前这个需求的流程是：提需求 → 排期 → 写 SQL → 导出 Excel。

现在有了 SQLBot，业务同学自己一句话就能查。

`SQLBot` 是 DataEase 开源项目组出品的**智能问数系统**（ChatBI），基于大模型和 `RAG` 技术。你用自然语言提问，它自动生成 SQL、执行查询、返回表格和图表。

## 它能做什么

- 自然语言提问，自动生成并执行 SQL；
- 结果自动生成可视化图表，支持切换图表类型；
- 支持追问，比如"只看今年的数据"；
- 图表可以拖进仪表板，拼成数据看板；
- 支持术语库和 SQL 示例库，让模型更懂业务；
- 支持工作空间隔离和细粒度权限，数据安全可控；
- 支持 Web 嵌入和 `MCP` 调用，可以集成到自己的系统里。

## 五分钟跑起来

安装好 Docker 后，一条命令：

```bash
docker run -d \
  --name sqlbot \
  --restart unless-stopped \
  -p 8000:8000 \
  -p 8001:8001 \
  -v ./data/sqlbot/excel:/opt/sqlbot/data/excel \
  -v ./data/sqlbot/file:/opt/sqlbot/data/file \
  -v ./data/sqlbot/images:/opt/sqlbot/images \
  -v ./data/sqlbot/logs:/opt/sqlbot/logs \
  -v ./data/postgresql:/var/lib/postgresql/data \
  --privileged=true \
  dataease/sqlbot
```

等容器启动完，浏览器打开 `http://localhost:8000`：

```text
用户名：admin
密码：SQLBot@123456
```

登录后改掉默认密码，然后做两件事：

1. **配模型**：系统管理 → AI 模型配置 → 添加模型，填 API Key 和模型名；
2. **配数据源**：数据源 → 新建，`MySQL`、`PostgreSQL`、`SQL Server` 等都支持，没有现成数据库也可以直接导入 Excel/CSV。

然后就可以在"智能问数"里随便问了，比如："查询本月销售额最高的 10 个商品"。

## 实际用下来的感受

**好的方面：**

- 上手门槛很低，配好模型和数据源就能用，不需要写一行代码；
- 简单的统计、分组、排序类查询，生成的 SQL 质量不错；
- 追问体验好，第一次问"订单量趋势"，接着问"只看华东区"，它能理解上下文；
- 表结构和字段注释写得清楚的库，效果明显更好。

**要注意的：**

- 模型名要和模型服务里的渠道名完全一致，差一个字符就报 `model_not_found`；
- 数据库结构混乱、没有注释的话，SQL 准确率会下降，可以用术语库补充业务含义；
- 复杂的业务规则（比如"有效订单要排除哪些状态"）需要提前在术语库或提示词里说清楚；
- 生产环境记得配反向代理、`HTTPS`，并定期备份挂载的 `data` 目录。

## 适合谁用

- 业务、运营同学：不用求人就能自助查数；
- 小团队：没有专职 BI 也能有数据看板；
- 开发者：通过 `MCP` 和嵌入式方式，给自己的系统加问数能力。

## 总结

`SQLBot` 解决的是一个很实际的问题：让不写 SQL 的人也能安全地查数。一条 Docker 命令就能本地跑起来，成本几乎为零，值得一试。

## 参考链接

- [GitHub 仓库](https://github.com/dataease/SQLBot)
- [官方文档](https://dataease.cn/sqlbot/)
