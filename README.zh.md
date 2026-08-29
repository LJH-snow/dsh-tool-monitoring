# dsh-tool-monitoring

[English](README.md) | 中文

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）提供可观测性与告警能力的 Cordis 工具插件。Agent 可以查询 Prometheus、查看 target/alert/rule/series/label 与 TSDB 状态，运行 Loki LogQL 查询并查看日志 label、series、index 统计、rule group、rule、告警、index volume 与检测到的模式，查看 Grafana 健康状态、数据源、面板与目录，还可以管理 Alertmanager 的告警、告警分组、静默与接收人。

插件遵循官方「一切皆插件」架构，通过 `ctx.tools.register(defineTool(...))` 注册模型可见工具，并符合 [adding-a-tool](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-tool.md) 契约。

## 安装

从 npm 安装：

```sh
npm install @libai168/dsh-tool-monitoring
```

或直接从 GitHub 安装：

```sh
npm install github:LJH-snow/dsh-tool-monitoring
```

需要 `@deepseek-ai/cordis`（^4.0.1）与 `@deepseek-ai/dsh-tools`（^0.1.0-rc.6）作为 peer 依赖，由宿主 dsh 运行时提供。

## 配置

在 dsh 的组合配置（`cordis.yml`）中加载插件：

```yaml
- name: 'github:LJH-snow/dsh-tool-monitoring'
  config:
    prometheusBaseUrl: 'http://prometheus:9090'       # 可选，默认 http://localhost:9090
    prometheusToken: 'plain_token_or_Bearer_token'    # 可选
    alertmanagerBaseUrl: 'http://alertmanager:9093'   # 可选，默认 http://localhost:9093
    alertmanagerToken: 'plain_token_or_Bearer_token'  # 可选
    lokiBaseUrl: 'http://loki:3100'                   # 可选，默认 http://localhost:3100
    lokiToken: 'plain_token_or_Bearer_token'          # 可选
    lokiTenantId: 'tenant-a'                          # 可选，仅多租户 Loki 需要
    grafanaBaseUrl: 'http://grafana:3000'             # 可选，默认 http://localhost:3000
    grafanaToken: 'plain_token_or_Bearer_token'       # 可选
    timeoutMs: 15000                                  # 可选，默认 15000
    allowWrite: false                                 # 可选，写工具默认关闭
```

完整示例见 [examples/cordis.yml](examples/cordis.yml)。

四个组件都支持 Token 或 Basic Auth：Prometheus 使用 `prometheusToken`/`prometheusUsername`/`prometheusPassword`，Alertmanager 使用 `alertmanagerToken`/`alertmanagerUsername`/`alertmanagerPassword`，Loki 使用 `lokiToken`/`lokiUsername`/`lokiPassword`，Grafana 使用 `grafanaToken`/`grafanaUsername`/`grafanaPassword`。将 base URL 配置为空字符串可禁用对应组件，此时读工具返回明确的 `{ connected: false, reason }`。多租户 Loki 可额外配置 `lokiTenantId`。

> 安全说明：写工具由 `allowWrite` 控制。除非允许 dsh 删除 Prometheus 序列、创建或删除 Alertmanager 静默、发送告警，否则保持关闭。

## 提供的工具

Prometheus 工具：

| 工具 | 说明 | 写操作 |
|---|---|---|
| `prometheus_query` | 运行 PromQL 即时查询 | 否 |
| `prometheus_query_range` | 按时间范围计算 PromQL 表达式 | 否 |
| `prometheus_list_targets` | 查看抓取 target、健康状态与 last error | 否 |
| `prometheus_list_alerts` | 查看活跃告警的 labels、annotations、state 和 value | 否 |
| `prometheus_list_rules` | 查看 recording 与 alerting rules | 否 |
| `prometheus_list_series` | 按 PromQL selector 查找 series label 集合 | 否 |
| `prometheus_list_labels` | 查看可用 label 名 | 否 |
| `prometheus_get_label_values` | 查看某个 label 的值 | 否 |
| `prometheus_get_tsdb_status` | 查看 TSDB 基线与 head block 统计 | 否 |
| `prometheus_delete_series` | 按 PromQL selector 删除序列 | 是 |

Loki 工具：

| 工具 | 说明 | 写操作 |
|---|---|---|
| `loki_query` | 运行 LogQL 即时查询 | 否 |
| `loki_query_range` | 按时间范围查询日志或指标流 | 否 |
| `loki_list_labels` | 可选按 selector 和时间范围查看 label 名 | 否 |
| `loki_get_label_values` | 查看某个 label 的值 | 否 |
| `loki_list_series` | 按 LogQL selector 查找 streams | 否 |
| `loki_get_index_stats` | 查看 streams/chunks/entries/bytes 索引统计 | 否 |
| `loki_get_status` | 查看 Loki 构建信息 | 否 |
| `loki_list_rule_groups` | 查看当前 tenant 的 ruler rule groups（YAML） | 否 |
| `loki_list_rules` | 查看 Loki 暴露的 alerting 与 recording rules | 否 |
| `loki_list_alerts` | 查看活跃 Loki alerting rules | 否 |
| `loki_get_index_volume` | 查看 label/series 聚合的 index volume | 否 |
| `loki_get_index_volume_range` | 按时间范围查看 index volume matrix | 否 |
| `loki_get_patterns` | 查看 Loki 日志中检测到的 patterns | 否 |

Grafana 工具：

| 工具 | 说明 | 写操作 |
|---|---|---|
| `grafana_get_health` | 查看健康状态、数据库状态、版本与 commit | 否 |
| `grafana_list_datasources` | 查看数据源及安全连接信息 | 否 |
| `grafana_get_datasource` | 按 UID 查看单个数据源 | 否 |
| `grafana_search_dashboards` | 按 query、tag、starred、分页搜索面板 | 否 |
| `grafana_get_dashboard` | 按 UID 查看面板 JSON、元数据与 panel 数 | 否 |
| `grafana_list_folders` | 查看目录 UID、标题与 URL | 否 |

Alertmanager 工具：

| 工具 | 说明 | 写操作 |
|---|---|---|
| `alertmanager_get_status` | 查看版本、uptime 与状态信息 | 否 |
| `alertmanager_list_alerts` | 按 filter/receiver 查看告警 | 否 |
| `alertmanager_list_alert_groups` | 按 receiver 查看告警分组 | 否 |
| `alertmanager_list_silences` | 查看静默 matcher 与时间计划 | 否 |
| `alertmanager_list_receivers` | 查看当前接收人名称 | 否 |
| `alertmanager_create_silence` | 使用 JSON matchers 创建静默 | 是 |
| `alertmanager_delete_silence` | 按 silence ID 删除静默 | 是 |
| `alertmanager_send_alerts` | 以 JSON 数组发送告警 | 是 |

### 行为约定

- 未配置组件 base URL 时，读工具返回 `{ connected: false, reason }`。
- `allowWrite` 关闭或监控服务返回校验错误时，写工具返回 `{ ok: false, reason }`。
- Prometheus/Loki API 层错误和写操作 HTTP 400 映射为业务失败值。
- 凭据无效（401）、访问禁止（403）、限流（429）、服务器错误（5xx）等基础设施错误直接抛出 `MonitoringError`。
- 每个请求都透传 `exec.signal`，并使用可配置超时（默认 15 秒）。

## 开发

```sh
npm install
npm run typecheck
npm test
npm run build
```

架构与测试计划见 [DEVELOPMENT.md](DEVELOPMENT.md)。

## License

[MIT](LICENSE)
