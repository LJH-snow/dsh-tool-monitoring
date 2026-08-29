# dsh-tool-monitoring

[English](README.md) | [中文](README.zh.md)

A Cordis tool plugin that gives [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) monitoring and alerting capabilities. Agents can query Prometheus, inspect targets, alerts, rules, series, labels and TSDB status, run Loki LogQL queries and inspect log labels, series, index statistics, rule groups, rules, alerts, index volume and detected patterns, and manage Alertmanager alerts, alert groups, silences and receivers.

It follows the official plugin architecture with `ctx.tools.register(defineTool(...))` and the [adding-a-tool](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-tool.md) contract.

## Install

Install from npm:

```sh
npm install @libai168/dsh-tool-monitoring
```

Or install directly from GitHub:

```sh
npm install github:LJH-snow/dsh-tool-monitoring
```

Requires `@deepseek-ai/cordis` (^4.0.1) and `@deepseek-ai/dsh-tools` (^0.1.0-rc.6) as peer dependencies, provided by the host dsh runtime.

## Configuration

Load the plugin in a dsh composition config (`cordis.yml`):

```yaml
- name: 'github:LJH-snow/dsh-tool-monitoring'
  config:
    prometheusBaseUrl: 'http://prometheus:9090'       # optional, default http://localhost:9090
    prometheusToken: 'plain_token_or_Bearer_token'    # optional
    alertmanagerBaseUrl: 'http://alertmanager:9093'   # optional, default http://localhost:9093
    alertmanagerToken: 'plain_token_or_Bearer_token'  # optional
    lokiBaseUrl: 'http://loki:3100'                   # optional, default http://localhost:3100
    lokiToken: 'plain_token_or_Bearer_token'          # optional
    lokiTenantId: 'tenant-a'                          # optional, multi-tenant Loki only
    timeoutMs: 15000                                  # optional, default 15000
    allowWrite: false                                 # optional, write tools are disabled by default
```

Full example: [examples/cordis.yml](examples/cordis.yml).

Each component can also use HTTP Basic Auth with `prometheusUsername`/`prometheusPassword`, `alertmanagerUsername`/`alertmanagerPassword`, or `lokiUsername`/`lokiPassword`. Set a base URL to an empty string to disable that component and return an explicit `connected: false` business value.

> Security: write tools are gated by `allowWrite`. Keep it `false` unless the dsh runtime is explicitly allowed to delete Prometheus series, create or delete Alertmanager silences, or send alerts.

## Tools

Prometheus tools:

| Tool | Description | Write |
|---|---|---|
| `prometheus_query` | Run a PromQL instant query | no |
| `prometheus_query_range` | Evaluate a PromQL expression over a time range | no |
| `prometheus_list_targets` | List scrape targets with health and last error | no |
| `prometheus_list_alerts` | List active alerts with labels, annotations, state and values | no |
| `prometheus_list_rules` | List recording and alerting rules | no |
| `prometheus_list_series` | Find series label sets matching a PromQL selector | no |
| `prometheus_list_labels` | List label names | no |
| `prometheus_get_label_values` | List values for one label | no |
| `prometheus_get_tsdb_status` | Read TSDB cardinality and head block statistics | no |
| `prometheus_delete_series` | Delete series matching PromQL selectors | yes |

Loki tools:

| Tool | Description | Write |
|---|---|---|
| `loki_query` | Run a LogQL instant query | no |
| `loki_query_range` | Query Loki logs or metric streams over a range | no |
| `loki_list_labels` | List label names, optionally by selector and time range | no |
| `loki_get_label_values` | List values for one label | no |
| `loki_list_series` | Find streams matching LogQL selectors | no |
| `loki_get_index_stats` | Read index statistics for streams, chunks, entries and bytes | no |
| `loki_get_status` | Read Loki build information | no |
| `loki_list_rule_groups` | List ruler rule groups for the tenant as YAML | no |
| `loki_list_rules` | List alerting and recording rules exposed by Loki | no |
| `loki_list_alerts` | List active Loki alerting rules | no |
| `loki_get_index_volume` | Get index volume for labels or series | no |
| `loki_get_index_volume_range` | Get index volume as a matrix over a range | no |
| `loki_get_patterns` | Get patterns detected in Loki logs | no |

Alertmanager tools:

| Tool | Description | Write |
|---|---|---|
| `alertmanager_get_status` | Get version, uptime and status payload | no |
| `alertmanager_list_alerts` | List alerts with filters and receiver | no |
| `alertmanager_list_alert_groups` | List alert groups by receiver | no |
| `alertmanager_list_silences` | List silences with matchers and schedule | no |
| `alertmanager_list_receivers` | List receiver names | no |
| `alertmanager_create_silence` | Create a silence with JSON matchers | yes |
| `alertmanager_delete_silence` | Delete a silence by ID | yes |
| `alertmanager_send_alerts` | Send an alert batch as JSON | yes |

### Behavior Contract

- If a component base URL is not configured, read tools return `{ connected: false, reason }`.
- Write tools return `{ ok: false, reason }` when `allowWrite` is disabled or when the monitoring service rejects the request with a validation error.
- Prometheus and Loki API-level errors plus HTTP 400 write validation errors are mapped to business failure values.
- Infrastructure errors such as invalid credentials (401), forbidden access (403), rate limiting (429), or server failures (5xx) throw `MonitoringError`.
- Every request forwards `exec.signal` and uses a configurable timeout (default 15 seconds).

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture and coverage.

## License

[MIT](LICENSE)
