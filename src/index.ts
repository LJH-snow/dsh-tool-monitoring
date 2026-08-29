import type { Context } from '@deepseek-ai/cordis'
import type { ToolCallView, ToolResultView } from '@deepseek-ai/dsh-tools'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  MonitoringClient,
  MonitoringError,
  type AlertmanagerAlertItem,
  type AlertmanagerGroupItem,
  type AlertmanagerSilenceItem,
  type GrafanaDashboardData,
  type GrafanaDashboardSummaryItem,
  type GrafanaDatasourceItem,
  type GrafanaFolderItem,
  type GrafanaHealthData,
  type LokiAlertItem,
  type LokiIndexStats,
  type LokiPatternItem,
  type LokiQueryData,
  type LokiRuleItem,
  type LokiSeriesItem,
  type LokiStatusData,
  type LokiVolumeData,
  type PrometheusAlertItem,
  type PrometheusRuleItem,
  type PrometheusTargetItem,
} from './client.js'

export const name = 'dsh-tool-monitoring'
export const inject = ['tools']

export interface MonitoringPluginConfig {
  prometheusBaseUrl?: string
  prometheusToken?: string
  prometheusUsername?: string
  prometheusPassword?: string
  alertmanagerBaseUrl?: string
  alertmanagerToken?: string
  alertmanagerUsername?: string
  alertmanagerPassword?: string
  lokiBaseUrl?: string
  lokiToken?: string
  lokiUsername?: string
  lokiPassword?: string
  lokiTenantId?: string
  grafanaBaseUrl?: string
  grafanaToken?: string
  grafanaUsername?: string
  grafanaPassword?: string
  timeoutMs?: number
  allowWrite?: boolean
}

export function apply(ctx: Context, config: MonitoringPluginConfig = {}) {
  const client = new MonitoringClient(config)
  for (const tool of createTools(client)) {
    ctx.tools.register(tool)
  }
}

/** Build the tool definitions for a client. Exported so tests can drive execute/render directly. */
export function createTools(client: MonitoringClient) {
  return [
    defineTool({
      name: 'prometheus_query',
      description: 'Run a Prometheus instant vector, scalar, string, or matrix query.',
      parameters: {
        query: { type: 'string', required: true, description: 'PromQL expression' },
        time: { type: 'string', description: 'Evaluation timestamp in RFC 3339 or Unix milliseconds; optional' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            resultType: { type: 'string' },
            seriesCount: { type: 'number' },
            resultJson: { type: 'string' },
          },
        },
        render: (_args, value) => renderQuery(value),
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Prometheus query: ${args.query}`, kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; seriesCount?: number }
        if (!v.connected) return { card: 'generic', title: 'Prometheus unavailable' }
        return { card: 'generic', title: `${v.seriesCount ?? 0} result(s)` }
      },
      async execute(args, exec) {
        if (!client.hasPrometheus()) return unavailable('Prometheus base URL is not configured.')
        const data = await client.query(args.query as string, { time: args.time, signal: exec.signal })
        return data
      },
    }),

    defineTool({
      name: 'prometheus_query_range',
      description: 'Evaluate a PromQL expression over a time range and return matrix samples.',
      parameters: {
        query: { type: 'string', required: true, description: 'PromQL expression' },
        start: { type: 'string', required: true, description: 'Range start as Unix time, RFC 3339, or relative time' },
        end: { type: 'string', required: true, description: 'Range end as Unix time, RFC 3339, or relative time' },
        step: { type: 'string', required: true, description: 'Query resolution step, for example 60s' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            resultType: { type: 'string' },
            seriesCount: { type: 'number' },
            resultJson: { type: 'string' },
          },
        },
        render: (_args, value) => renderQuery(value),
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Prometheus range: ${args.query}`, kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; seriesCount?: number }
        if (!v.connected) return { card: 'generic', title: 'Prometheus unavailable' }
        return { card: 'generic', title: `${v.seriesCount ?? 0} series` }
      },
      async execute(args, exec) {
        if (!client.hasPrometheus()) return unavailable('Prometheus base URL is not configured.')
        return client.queryRange(args.query as string, {
          start: args.start as string,
          end: args.end as string,
          step: args.step as string,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'prometheus_list_targets',
      description: 'List active and dropped Prometheus scrape targets with health and last error.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            activeCount: { type: 'number' },
            droppedCount: { type: 'number' },
            items: { type: 'array', items: targetItemSchema },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Prometheus is not configured.')
          return renderTargets(value)
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Prometheus targets', kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; activeCount?: number }
        if (!v.connected) return { card: 'generic', title: 'Prometheus unavailable' }
        return { card: 'generic', title: `${v.activeCount ?? 0} active target(s)` }
      },
      async execute(_args, exec) {
        if (!client.hasPrometheus()) return unavailable('Prometheus base URL is not configured.')
        return client.listTargets({ signal: exec.signal })
      },
    }),

    defineTool({
      name: 'prometheus_list_alerts',
      description: 'List active Prometheus alerts with labels, annotations, state, and values.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: prometheusAlertItemSchema },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Prometheus is not configured.')
          return renderPrometheusAlerts(value.items ?? [])
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Prometheus alerts', kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: unknown[] }
        if (!v.connected) return { card: 'generic', title: 'Prometheus unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} alert(s)` }
      },
      async execute(_args, exec) {
        if (!client.hasPrometheus()) return unavailable('Prometheus base URL is not configured.')
        return client.listAlerts({ signal: exec.signal })
      },
    }),

    defineTool({
      name: 'prometheus_list_rules',
      description: 'List Prometheus recording and alerting rules together with active alert counts.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: prometheusRuleItemSchema },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Prometheus is not configured.')
          return renderRules(value.items ?? [])
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Prometheus rules', kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: unknown[] }
        if (!v.connected) return { card: 'generic', title: 'Prometheus unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} rule(s)` }
      },
      async execute(_args, exec) {
        if (!client.hasPrometheus()) return unavailable('Prometheus base URL is not configured.')
        return client.listRules({ signal: exec.signal })
      },
    }),

    defineTool({
      name: 'prometheus_list_series',
      description: 'Find Prometheus series label sets matching a PromQL selector.',
      parameters: {
        match: { type: 'string', required: true, description: 'PromQL series selector, for example up' },
        start: { type: 'string', description: 'Optional start time' },
        end: { type: 'string', description: 'Optional end time' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: { labelsJson: { type: 'string' } },
              },
            },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Prometheus is not configured.')
          return text((value.items ?? []).map((item: any) => item.labelsJson ?? '').join('\n'))
        },
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Prometheus series ${args.match}`, kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: unknown[] }
        if (!v.connected) return { card: 'generic', title: 'Prometheus unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} series` }
      },
      async execute(args, exec) {
        if (!client.hasPrometheus()) return unavailable('Prometheus base URL is not configured.')
        return client.listSeries(args.match as string, {
          start: args.start,
          end: args.end,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'prometheus_list_labels',
      description: 'List label names available in Prometheus.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: { type: 'string' } },
          },
        },
        render: (_args, value) => renderStrings(value, 'No Prometheus labels found.'),
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Prometheus labels', kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: string[] }
        if (!v.connected) return { card: 'generic', title: 'Prometheus unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} label(s)` }
      },
      async execute(_args, exec) {
        if (!client.hasPrometheus()) return unavailable('Prometheus base URL is not configured.')
        return client.listLabels({ signal: exec.signal })
      },
    }),

    defineTool({
      name: 'prometheus_get_label_values',
      description: 'List values for one Prometheus label.',
      parameters: {
        labelName: { type: 'string', required: true, description: 'Prometheus label name' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: { type: 'string' } },
          },
        },
        render: (_args, value) => renderStrings(value, 'No values found for this label.'),
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Prometheus label ${args.labelName}`, kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: string[] }
        if (!v.connected) return { card: 'generic', title: 'Prometheus unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} value(s)` }
      },
      async execute(args, exec) {
        if (!client.hasPrometheus()) return unavailable('Prometheus base URL is not configured.')
        return client.getLabelValues(args.labelName as string, { signal: exec.signal })
      },
    }),

    defineTool({
      name: 'prometheus_get_tsdb_status',
      description: 'Get Prometheus TSDB cardinality and head block statistics.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            headSeriesCount: { type: 'number' },
            statsJson: { type: 'string' },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Prometheus is not configured.')
          return text(`head series: ${value.headSeriesCount ?? 0}\n${value.statsJson ?? ''}`)
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Prometheus TSDB status', kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; headSeriesCount?: number }
        if (!v.connected) return { card: 'generic', title: 'Prometheus unavailable' }
        return { card: 'generic', title: `${v.headSeriesCount ?? 0} head series` }
      },
      async execute(_args, exec) {
        if (!client.hasPrometheus()) return unavailable('Prometheus base URL is not configured.')
        return client.getTsdbStatus({ signal: exec.signal })
      },
    }),

    defineTool({
      name: 'prometheus_delete_series',
      description: 'Delete Prometheus series matching PromQL selectors. WRITE operation: requires allowWrite: true.',
      parameters: {
        matchersJson: { type: 'string', required: true, description: 'JSON array of PromQL selectors, for example ["up{instance=\"localhost:9090\"}"]' },
        start: { type: 'string', description: 'Optional start time' },
        end: { type: 'string', description: 'Optional end time' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean' },
            reason: { type: 'string' },
          },
        },
        render: (_args, value) => value.ok
          ? text('Prometheus series deleted.')
          : text(`Could not delete Prometheus series: ${value.reason}`),
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: 'Delete Prometheus series', kind: 'edit' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { ok?: boolean; reason?: string }
        return { card: 'generic', title: v.ok ? 'Series deleted' : 'Delete failed', content: [{ type: 'text', text: v.reason ?? '' }] }
      },
      async execute(args, exec) {
        const matchers = parseJsonArray(args.matchersJson)
        if (!matchers.ok) return { ok: false, reason: 'matchersJson must be a valid JSON array.' }
        if (!matchers.value?.length || matchers.value.some(matcher => typeof matcher !== 'string' || !matcher.trim())) {
          return { ok: false, reason: 'matchersJson must contain non-empty PromQL selector strings.' }
        }
        return client.deleteSeries(matchers.value as string[], {
          start: args.start,
          end: args.end,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'alertmanager_get_status',
      description: 'Get Alertmanager version, uptime, cluster, and config status.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            uptime: { type: 'string' },
            version: { type: 'string' },
            statusJson: { type: 'string' },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Alertmanager is not configured.')
          return text(`version: ${value.version ?? ''}\nuptime: ${value.uptime ?? ''}\n${value.statusJson ?? ''}`)
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Alertmanager status', kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; version?: string }
        return { card: 'generic', title: v.connected ? `Alertmanager ${v.version ?? ''}` : 'Alertmanager unavailable' }
      },
      async execute(_args, exec) {
        if (!client.hasAlertmanager()) return unavailable('Alertmanager base URL is not configured.')
        return client.getAlertmanagerStatus({ signal: exec.signal })
      },
    }),

    defineTool({
      name: 'alertmanager_list_alerts',
      description: 'List Alertmanager alerts with labels, annotations, status, and receivers.',
      parameters: {
        filter: { type: 'string', description: 'Matcher expression, for example alertname="HighCPUUsage"' },
        active: { type: 'boolean', description: 'Include active alerts (default true)' },
        silenced: { type: 'boolean', description: 'Include silenced alerts (default true)' },
        inhibited: { type: 'boolean', description: 'Include inhibited alerts (default true)' },
        receiver: { type: 'string', description: 'Filter by receiver name regex' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: alertmanagerAlertItemSchema },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Alertmanager is not configured.')
          return renderAlertmanagerAlerts(value.items ?? [])
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Alertmanager alerts', kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: unknown[] }
        if (!v.connected) return { card: 'generic', title: 'Alertmanager unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} alert(s)` }
      },
      async execute(args, exec) {
        if (!client.hasAlertmanager()) return unavailable('Alertmanager base URL is not configured.')
        return client.listAlertmanagerAlerts({
          filter: args.filter,
          active: args.active,
          silenced: args.silenced,
          inhibited: args.inhibited,
          receiver: args.receiver,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'alertmanager_list_alert_groups',
      description: 'List Alertmanager alert groups by receiver and labels.',
      parameters: {
        receiver: { type: 'string', description: 'Filter by receiver name' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: alertmanagerGroupItemSchema },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Alertmanager is not configured.')
          return renderAlertGroups(value.items ?? [])
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Alertmanager groups', kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: unknown[] }
        if (!v.connected) return { card: 'generic', title: 'Alertmanager unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} group(s)` }
      },
      async execute(args, exec) {
        if (!client.hasAlertmanager()) return unavailable('Alertmanager base URL is not configured.')
        return client.listAlertGroups({ receiver: args.receiver, signal: exec.signal })
      },
    }),

    defineTool({
      name: 'alertmanager_list_silences',
      description: 'List Alertmanager silences with matchers, schedule, creator, and status.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: alertmanagerSilenceItemSchema },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Alertmanager is not configured.')
          return renderSilences(value.items ?? [])
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Alertmanager silences', kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: unknown[] }
        if (!v.connected) return { card: 'generic', title: 'Alertmanager unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} silence(s)` }
      },
      async execute(_args, exec) {
        if (!client.hasAlertmanager()) return unavailable('Alertmanager base URL is not configured.')
        return client.listSilences({ signal: exec.signal })
      },
    }),

    defineTool({
      name: 'alertmanager_list_receivers',
      description: 'List Alertmanager receiver names from the current routing configuration.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: { name: { type: 'string' } },
              },
            },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Alertmanager is not configured.')
          const names = (value.items ?? []).map((item: any) => item.name ?? '').filter(Boolean)
          return text(names.length > 0 ? names.join('\n') : 'No Alertmanager receivers found.')
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Alertmanager receivers', kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: unknown[] }
        return { card: 'generic', title: v.connected ? `${(v.items ?? []).length} receiver(s)` : 'Alertmanager unavailable' }
      },
      async execute(_args, exec) {
        if (!client.hasAlertmanager()) return unavailable('Alertmanager base URL is not configured.')
        return client.listReceivers({ signal: exec.signal })
      },
    }),

    defineTool({
      name: 'alertmanager_create_silence',
      description: 'Create an Alertmanager silence. WRITE operation: requires allowWrite: true.',
      parameters: {
        matchersJson: { type: 'string', required: true, description: 'JSON array of matchers, for example [{"name":"alertname","value":"HighCPUUsage"}]' },
        startsAt: { type: 'string', required: true, description: 'RFC 3339 start time' },
        endsAt: { type: 'string', required: true, description: 'RFC 3339 end time' },
        createdBy: { type: 'string', required: true, description: 'Silence creator' },
        comment: { type: 'string', required: true, description: 'Why this silence exists' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean' },
            id: { type: 'string' },
            reason: { type: 'string' },
          },
        },
        render: (_args, value) => value.ok
          ? text(`Silence created: ${value.id ?? ''}`)
          : text(`Could not create silence: ${value.reason}`),
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Create Alertmanager silence', kind: 'edit' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { ok?: boolean; id?: string; reason?: string }
        return { card: 'generic', title: v.ok ? `Silence ${v.id ?? ''} created` : 'Create silence failed', content: [{ type: 'text', text: v.reason ?? '' }] }
      },
      async execute(args, exec) {
        const matchers = parseJsonArray(args.matchersJson)
        if (!matchers.ok) return { ok: false, reason: 'matchersJson must be a valid JSON array.' }
        if (!matchers.value?.length || matchers.value.some(matcher => !isValidMatcher(matcher))) {
          return { ok: false, reason: 'matchersJson must contain matcher objects with name and value strings.' }
        }
        if (!args.startsAt || !args.endsAt || !args.createdBy || !args.comment) {
          return { ok: false, reason: 'startsAt, endsAt, createdBy, and comment are required.' }
        }
        return client.createSilence({
          matchers: matchers.value,
          startsAt: args.startsAt as string,
          endsAt: args.endsAt as string,
          createdBy: args.createdBy as string,
          comment: args.comment as string,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'alertmanager_delete_silence',
      description: 'Delete an Alertmanager silence. WRITE operation: requires allowWrite: true.',
      parameters: {
        silenceId: { type: 'string', required: true, description: 'Alertmanager silence ID' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean' },
            reason: { type: 'string' },
          },
        },
        render: (_args, value) => value.ok
          ? text(`Silence ${_args.silenceId} deleted.`)
          : text(`Could not delete silence: ${value.reason}`),
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Delete silence ${args.silenceId}`, kind: 'edit' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { ok?: boolean; reason?: string }
        return { card: 'generic', title: v.ok ? 'Silence deleted' : 'Delete silence failed', content: [{ type: 'text', text: v.reason ?? '' }] }
      },
      async execute(args, exec) {
        if (!args.silenceId) return { ok: false, reason: 'silenceId is required.' }
        return client.deleteSilence(args.silenceId as string, exec.signal)
      },
    }),

    defineTool({
      name: 'alertmanager_send_alerts',
      description: 'Send alerts to Alertmanager. WRITE operation: requires allowWrite: true.',
      parameters: {
        alertsJson: { type: 'string', required: true, description: 'JSON array of alerts with labels and optional annotations' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean' },
            reason: { type: 'string' },
          },
        },
        render: (_args, value) => value.ok
          ? text('Alerts sent to Alertmanager.')
          : text(`Could not send alerts: ${value.reason}`),
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Send Alertmanager alerts', kind: 'edit' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { ok?: boolean; reason?: string }
        return { card: 'generic', title: v.ok ? 'Alerts sent' : 'Send alerts failed', content: [{ type: 'text', text: v.reason ?? '' }] }
      },
      async execute(args, exec) {
        const alerts = parseJsonArray(args.alertsJson)
        if (!alerts.ok) return { ok: false, reason: 'alertsJson must be a valid JSON array.' }
        if (!alerts.value?.length || alerts.value.some(alert => !isValidAlert(alert))) {
          return { ok: false, reason: 'alertsJson must contain alert objects with labels objects.' }
        }
        return client.sendAlerts(alerts.value, exec.signal)
      },
    }),

    defineTool({
      name: 'loki_query',
      description: 'Run a Loki LogQL instant query against a single point in time.',
      parameters: {
        query: { type: 'string', required: true, description: 'LogQL expression, for example sum(rate({job="app"}[5m]))' },
        time: { type: 'string', description: 'Evaluation time as Unix nanoseconds, RFC 3339, or a supported Loki timestamp' },
        limit: { type: 'integer', description: 'Maximum entries, default 100' },
        direction: { type: 'string', enum: ['backward', 'forward'], description: 'Log sort direction, default backward' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            resultType: { type: 'string' },
            seriesCount: { type: 'number' },
            entryCount: { type: 'number' },
            resultJson: { type: 'string' },
          },
        },
        render: (_args, value) => renderLokiQuery(value),
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Loki query: ${args.query}`, kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; seriesCount?: number; entryCount?: number }
        if (!v.connected) return { card: 'generic', title: 'Loki unavailable' }
        return { card: 'generic', title: `${v.seriesCount ?? 0} stream(s), ${v.entryCount ?? 0} entries` }
      },
      async execute(args, exec) {
        if (!client.hasLoki()) return unavailable('Loki base URL is not configured.')
        return client.lokiQuery(args.query as string, {
          time: args.time,
          limit: args.limit,
          direction: args.direction,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'loki_query_range',
      description: 'Query Loki logs or metric streams over a time range with LogQL.',
      parameters: {
        query: { type: 'string', required: true, description: 'LogQL expression' },
        start: { type: 'string', description: 'Start time as Unix nanoseconds, RFC 3339, or a supported Loki timestamp' },
        end: { type: 'string', description: 'End time as Unix nanoseconds, RFC 3339, or a supported Loki timestamp' },
        step: { type: 'string', description: 'Metric query step, for example 5m or 300' },
        limit: { type: 'integer', description: 'Maximum entries, default 100' },
        direction: { type: 'string', enum: ['backward', 'forward'], description: 'Log sort direction, default backward' },
        interval: { type: 'string', description: 'Only return log entries at or above this interval, for example 30s' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            resultType: { type: 'string' },
            seriesCount: { type: 'number' },
            entryCount: { type: 'number' },
            resultJson: { type: 'string' },
          },
        },
        render: (_args, value) => renderLokiQuery(value),
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Loki range: ${args.query}`, kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; seriesCount?: number; entryCount?: number }
        if (!v.connected) return { card: 'generic', title: 'Loki unavailable' }
        return { card: 'generic', title: `${v.seriesCount ?? 0} stream(s), ${v.entryCount ?? 0} entries` }
      },
      async execute(args, exec) {
        if (!client.hasLoki()) return unavailable('Loki base URL is not configured.')
        return client.lokiQueryRange(args.query as string, {
          start: args.start,
          end: args.end,
          step: args.step,
          limit: args.limit,
          direction: args.direction,
          interval: args.interval,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'loki_list_labels',
      description: 'List Loki label names, optionally filtered by a stream selector and time range.',
      parameters: {
        query: { type: 'string', description: 'Optional LogQL stream selector, for example {app="myapp"}' },
        start: { type: 'string', description: 'Optional start time as Unix nanoseconds or RFC 3339' },
        end: { type: 'string', description: 'Optional end time as Unix nanoseconds or RFC 3339' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: { type: 'string' } },
          },
        },
        render: (_args, value) => renderLokiStrings(value, 'No Loki labels found.'),
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Loki labels ${args.query ?? ''}`, kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: string[] }
        if (!v.connected) return { card: 'generic', title: 'Loki unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} label(s)` }
      },
      async execute(args, exec) {
        if (!client.hasLoki()) return unavailable('Loki base URL is not configured.')
        return client.lokiListLabels({
          query: args.query,
          start: args.start,
          end: args.end,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'loki_get_label_values',
      description: 'List values for one Loki label, optionally filtered by a stream selector and time range.',
      parameters: {
        labelName: { type: 'string', required: true, description: 'Loki label name' },
        query: { type: 'string', description: 'Optional LogQL stream selector' },
        start: { type: 'string', description: 'Optional start time as Unix nanoseconds or RFC 3339' },
        end: { type: 'string', description: 'Optional end time as Unix nanoseconds or RFC 3339' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: { type: 'string' } },
          },
        },
        render: (_args, value) => renderLokiStrings(value, 'No values found for this Loki label.'),
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Loki label ${args.labelName}`, kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: string[] }
        if (!v.connected) return { card: 'generic', title: 'Loki unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} value(s)` }
      },
      async execute(args, exec) {
        if (!client.hasLoki()) return unavailable('Loki base URL is not configured.')
        return client.lokiGetLabelValues(args.labelName as string, {
          query: args.query,
          start: args.start,
          end: args.end,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'loki_list_series',
      description: 'Find Loki streams matching one or more LogQL stream selectors.',
      parameters: {
        matchesJson: { type: 'string', required: true, description: 'JSON array of LogQL stream selectors, for example ["{app=\\"api\\"}", "{job=\\"loki\\"}"]' },
        start: { type: 'string', description: 'Optional start time as Unix nanoseconds or RFC 3339' },
        end: { type: 'string', description: 'Optional end time as Unix nanoseconds or RFC 3339' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: lokiSeriesItemSchema },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Loki is not configured.')
          return renderLokiSeries(value.items ?? [])
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Loki series', kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: unknown[] }
        if (!v.connected) return { card: 'generic', title: 'Loki unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} stream(s)` }
      },
      async execute(args, exec) {
        if (!client.hasLoki()) return unavailable('Loki base URL is not configured.')
        const matches = parseJsonArray(args.matchesJson)
        if (!matches.ok) return unavailable('matchesJson must be a valid JSON array.')
        if (!matches.value?.length || matches.value.some(match => typeof match !== 'string' || !match.trim())) {
          return unavailable('matchesJson must contain non-empty LogQL stream selector strings.')
        }
        return client.lokiListSeries(matches.value as string[], {
          start: args.start,
          end: args.end,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'loki_get_index_stats',
      description: 'Get Loki index statistics for streams, chunks, entries, and bytes matching a LogQL selector.',
      parameters: {
        query: { type: 'string', required: true, description: 'LogQL matcher, for example {job="app"}' },
        start: { type: 'string', description: 'Optional start time as Unix nanoseconds or RFC 3339' },
        end: { type: 'string', description: 'Optional end time as Unix nanoseconds or RFC 3339' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            streams: { type: 'number' },
            chunks: { type: 'number' },
            entries: { type: 'number' },
            bytes: { type: 'number' },
            statsJson: { type: 'string' },
          },
        },
        render: (_args, value) => renderLokiIndexStats(value),
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Loki stats ${args.query}`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; streams?: number; chunks?: number; entries?: number; bytes?: number }
        if (!v.connected) return { card: 'generic', title: 'Loki unavailable' }
        return { card: 'generic', title: `${v.streams ?? 0} streams, ${v.bytes ?? 0} bytes` }
      },
      async execute(args, exec) {
        if (!client.hasLoki()) return unavailable('Loki base URL is not configured.')
        return client.lokiGetIndexStats(args.query as string, {
          start: args.start,
          end: args.end,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'loki_get_status',
      description: 'Get Loki build information including version, revision, branch, and Go version.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            version: { type: 'string' },
            revision: { type: 'string' },
            branch: { type: 'string' },
            buildDate: { type: 'string' },
            goVersion: { type: 'string' },
            statusJson: { type: 'string' },
          },
        },
        render: (_args, value) => renderLokiStatus(value),
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Loki status', kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; version?: string }
        return { card: 'generic', title: v.connected ? `Loki ${v.version ?? ''}` : 'Loki unavailable' }
      },
      async execute(_args, exec) {
        if (!client.hasLoki()) return unavailable('Loki base URL is not configured.')
        return client.lokiGetStatus({ signal: exec.signal })
      },
    }),

    defineTool({
      name: 'loki_list_rule_groups',
      description: 'List Loki ruler rule groups configured for the authenticated tenant as YAML.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            ruleGroupsYaml: { type: 'string' },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Loki is not configured.')
          return text(value.ruleGroupsYaml || 'No Loki rule groups found.')
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Loki rule groups', kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean }
        return { card: 'generic', title: v.connected ? 'Loki rule groups' : 'Loki unavailable' }
      },
      async execute(_args, exec) {
        if (!client.hasLoki()) return unavailable('Loki base URL is not configured.')
        return client.lokiListRuleGroups({ signal: exec.signal })
      },
    }),

    defineTool({
      name: 'loki_list_rules',
      description: 'List Loki alerting and recording rules exposed by the Prometheus-compatible rules endpoint.',
      parameters: {
        type: { type: 'string', enum: ['alert', 'record'], description: 'Optional rule type filter' },
        file: { type: 'string', description: 'Optional file/group file filter' },
        ruleGroup: { type: 'string', description: 'Optional rule group name filter' },
        ruleName: { type: 'string', description: 'Optional rule name filter' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: lokiRuleItemSchema },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Loki is not configured.')
          return renderLokiRules(value.items ?? [])
        },
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Loki rules ${args.type ?? ''}`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: unknown[] }
        if (!v.connected) return { card: 'generic', title: 'Loki unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} rule(s)` }
      },
      async execute(args, exec) {
        if (!client.hasLoki()) return unavailable('Loki base URL is not configured.')
        return client.lokiListRules({
          type: args.type,
          file: args.file,
          ruleGroup: args.ruleGroup,
          ruleName: args.ruleName,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'loki_list_alerts',
      description: 'List active Loki alerting rules from the Prometheus-compatible alerts endpoint.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: prometheusAlertItemSchema },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Loki is not configured.')
          return renderLokiAlerts(value.items ?? [])
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Loki alerts', kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: unknown[] }
        if (!v.connected) return { card: 'generic', title: 'Loki unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} alert(s)` }
      },
      async execute(_args, exec) {
        if (!client.hasLoki()) return unavailable('Loki base URL is not configured.')
        return client.lokiListAlerts({ signal: exec.signal })
      },
    }),

    defineTool({
      name: 'loki_get_index_volume',
      description: 'Get Loki index volume for label or series aggregation over a time range.',
      parameters: {
        query: { type: 'string', required: true, description: 'LogQL stream selector, for example {job="app"}' },
        start: { type: 'string', required: true, description: 'Start time as Unix nanoseconds or RFC 3339' },
        end: { type: 'string', required: true, description: 'End time as Unix nanoseconds or RFC 3339' },
        limit: { type: 'integer', description: 'Maximum series to return, default 100' },
        targetLabels: { type: 'string', description: 'Comma-separated labels to aggregate into' },
        aggregateBy: { type: 'string', enum: ['series', 'labels'], description: 'Aggregate into series or labels, default series' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            resultType: { type: 'string' },
            seriesCount: { type: 'number' },
            totalBytes: { type: 'number' },
            resultJson: { type: 'string' },
          },
        },
        render: (_args, value) => renderLokiVolume(value),
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Loki volume ${args.query}`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; seriesCount?: number; totalBytes?: number }
        if (!v.connected) return { card: 'generic', title: 'Loki unavailable' }
        return { card: 'generic', title: `${v.seriesCount ?? 0} series, ${v.totalBytes ?? 0} bytes` }
      },
      async execute(args, exec) {
        if (!client.hasLoki()) return unavailable('Loki base URL is not configured.')
        return client.lokiGetIndexVolume(args.query as string, {
          start: args.start as string,
          end: args.end as string,
          limit: args.limit,
          targetLabels: args.targetLabels,
          aggregateBy: args.aggregateBy,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'loki_get_index_volume_range',
      description: 'Get Loki index volume as a Prometheus-style matrix over a time range.',
      parameters: {
        query: { type: 'string', required: true, description: 'LogQL stream selector, for example {job="app"}' },
        start: { type: 'string', required: true, description: 'Start time as Unix nanoseconds or RFC 3339' },
        end: { type: 'string', required: true, description: 'End time as Unix nanoseconds or RFC 3339' },
        step: { type: 'string', description: 'Resolution step, for example 5m or 300' },
        limit: { type: 'integer', description: 'Maximum series to return, default 100' },
        targetLabels: { type: 'string', description: 'Comma-separated labels to aggregate into' },
        aggregateBy: { type: 'string', enum: ['series', 'labels'], description: 'Aggregate into series or labels, default series' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            resultType: { type: 'string' },
            seriesCount: { type: 'number' },
            totalBytes: { type: 'number' },
            resultJson: { type: 'string' },
          },
        },
        render: (_args, value) => renderLokiVolume(value),
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Loki volume range ${args.query}`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; seriesCount?: number; totalBytes?: number }
        if (!v.connected) return { card: 'generic', title: 'Loki unavailable' }
        return { card: 'generic', title: `${v.seriesCount ?? 0} series, ${v.totalBytes ?? 0} bytes` }
      },
      async execute(args, exec) {
        if (!client.hasLoki()) return unavailable('Loki base URL is not configured.')
        return client.lokiGetIndexVolumeRange(args.query as string, {
          start: args.start as string,
          end: args.end as string,
          step: args.step,
          limit: args.limit,
          targetLabels: args.targetLabels,
          aggregateBy: args.aggregateBy,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'loki_get_patterns',
      description: 'Get pattern detection results for Loki log streams over a time range.',
      parameters: {
        query: { type: 'string', required: true, description: 'LogQL stream selector, for example {job="app"}' },
        start: { type: 'string', required: true, description: 'Start time as Unix nanoseconds or RFC 3339' },
        end: { type: 'string', required: true, description: 'End time as Unix nanoseconds or RFC 3339' },
        step: { type: 'string', description: 'Step between pattern samples, for example 10s' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: lokiPatternItemSchema },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Loki is not configured.')
          return renderLokiPatterns(value.items ?? [])
        },
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Loki patterns ${args.query}`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: unknown[] }
        if (!v.connected) return { card: 'generic', title: 'Loki unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} pattern(s)` }
      },
      async execute(args, exec) {
        if (!client.hasLoki()) return unavailable('Loki base URL is not configured.')
        return client.lokiGetPatterns(args.query as string, {
          start: args.start as string,
          end: args.end as string,
          step: args.step,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'grafana_get_health',
      description: 'Get Grafana health, database status, version, and commit information.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            database: { type: 'string' },
            version: { type: 'string' },
            commit: { type: 'string' },
            statusJson: { type: 'string' },
          },
        },
        render: (_args, value) => renderGrafanaHealth(value),
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Grafana health', kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; version?: string }
        return { card: 'generic', title: v.connected ? `Grafana ${v.version ?? ''}` : 'Grafana unavailable' }
      },
      async execute(_args, exec) {
        if (!client.hasGrafana()) return unavailable('Grafana base URL is not configured.')
        return client.grafanaGetHealth({ signal: exec.signal })
      },
    }),

    defineTool({
      name: 'grafana_list_datasources',
      description: 'List Grafana datasources with safe connection metadata and URL.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: grafanaDatasourceItemSchema },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Grafana is not configured.')
          return renderGrafanaDatasources(value.items ?? [])
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Grafana datasources', kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: unknown[] }
        if (!v.connected) return { card: 'generic', title: 'Grafana unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} datasource(s)` }
      },
      async execute(_args, exec) {
        if (!client.hasGrafana()) return unavailable('Grafana base URL is not configured.')
        return client.grafanaListDatasources({ signal: exec.signal })
      },
    }),

    defineTool({
      name: 'grafana_get_datasource',
      description: 'Get one Grafana datasource by UID with safe connection metadata.',
      parameters: {
        uid: { type: 'string', required: true, description: 'Grafana datasource UID' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            item: grafanaDatasourceItemSchema,
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Grafana is not configured.')
          return renderGrafanaDatasource(value.item)
        },
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Grafana datasource ${args.uid}`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; item?: { name?: string } }
        return { card: 'generic', title: v.connected ? `Datasource ${v.item?.name ?? ''}` : 'Grafana unavailable' }
      },
      async execute(args, exec) {
        if (!client.hasGrafana()) return unavailable('Grafana base URL is not configured.')
        return client.grafanaGetDatasource(args.uid as string, { signal: exec.signal })
      },
    }),

    defineTool({
      name: 'grafana_search_dashboards',
      description: 'Search Grafana dashboards by query, tag, starred status, limit, and page.',
      parameters: {
        query: { type: 'string', description: 'Optional dashboard title search query' },
        tag: { type: 'string', description: 'Optional dashboard tag filter' },
        starred: { type: 'boolean', description: 'Optional flag to return only starred dashboards' },
        limit: { type: 'integer', description: 'Maximum results, default 1000' },
        page: { type: 'integer', description: 'Page number for results beyond the limit' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: grafanaDashboardSummaryItemSchema },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Grafana is not configured.')
          return renderGrafanaDashboards(value.items ?? [])
        },
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Grafana dashboards ${args.query ?? ''}`, kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: unknown[] }
        if (!v.connected) return { card: 'generic', title: 'Grafana unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} dashboard(s)` }
      },
      async execute(args, exec) {
        if (!client.hasGrafana()) return unavailable('Grafana base URL is not configured.')
        return client.grafanaSearchDashboards({
          query: args.query,
          tag: args.tag,
          starred: args.starred,
          limit: args.limit,
          page: args.page,
          signal: exec.signal,
        })
      },
    }),

    defineTool({
      name: 'grafana_get_dashboard',
      description: 'Get a full Grafana dashboard by UID with panel count and dashboard JSON.',
      parameters: {
        uid: { type: 'string', required: true, description: 'Grafana dashboard UID' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            uid: { type: 'string' },
            title: { type: 'string' },
            url: { type: 'string' },
            panelCount: { type: 'number' },
            dashboardJson: { type: 'string' },
            metaJson: { type: 'string' },
          },
        },
        render: (_args, value) => renderGrafanaDashboard(value),
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Grafana dashboard ${args.uid}`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; title?: string; panelCount?: number }
        return { card: 'generic', title: v.connected ? `${v.title ?? ''} (${v.panelCount ?? 0} panels)` : 'Grafana unavailable' }
      },
      async execute(args, exec) {
        if (!client.hasGrafana()) return unavailable('Grafana base URL is not configured.')
        return client.grafanaGetDashboard(args.uid as string, { signal: exec.signal })
      },
    }),

    defineTool({
      name: 'grafana_list_folders',
      description: 'List Grafana folders with UID, title, and URL.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            connected: { type: 'boolean' },
            reason: { type: 'string' },
            items: { type: 'array', items: grafanaFolderItemSchema },
          },
        },
        render: (_args, value) => {
          if (!value.connected) return text(value.reason ?? 'Grafana is not configured.')
          return renderGrafanaFolders(value.items ?? [])
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: 'Grafana folders', kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { connected?: boolean; items?: unknown[] }
        if (!v.connected) return { card: 'generic', title: 'Grafana unavailable' }
        return { card: 'generic', title: `${(v.items ?? []).length} folder(s)` }
      },
      async execute(_args, exec) {
        if (!client.hasGrafana()) return unavailable('Grafana base URL is not configured.')
        return client.grafanaListFolders({ signal: exec.signal })
      },
    }),
  ]
}

const lokiSeriesItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    labelsJson: { type: 'string' },
  },
} as const

const lokiRuleItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    group: { type: 'string' },
    file: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string' },
    health: { type: 'string' },
    lastError: { type: 'string' },
    query: { type: 'string' },
    duration: { type: 'string' },
    labelsJson: { type: 'string' },
    annotationsJson: { type: 'string' },
    activeAlertCount: { type: 'number' },
  },
} as const

const lokiPatternItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pattern: { type: 'string' },
    sampleCount: { type: 'number' },
    totalCount: { type: 'number' },
    samplesJson: { type: 'string' },
  },
} as const

const grafanaDatasourceItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'number' },
    uid: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string' },
    url: { type: 'string' },
    access: { type: 'string' },
    isDefault: { type: 'boolean' },
    basicAuth: { type: 'boolean' },
    withCredentials: { type: 'boolean' },
    database: { type: 'string' },
    user: { type: 'string' },
  },
} as const

const grafanaDashboardSummaryItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'number' },
    uid: { type: 'string' },
    title: { type: 'string' },
    url: { type: 'string' },
    type: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    isStarred: { type: 'boolean' },
    folderUid: { type: 'string' },
    folderTitle: { type: 'string' },
  },
} as const

const grafanaFolderItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'number' },
    uid: { type: 'string' },
    title: { type: 'string' },
    url: { type: 'string' },
  },
} as const

const targetItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scrapeUrl: { type: 'string' },
    health: { type: 'string' },
    lastError: { type: 'string' },
    labelsJson: { type: 'string' },
  },
} as const

const prometheusAlertItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    state: { type: 'string' },
    value: { type: 'string' },
    activeAt: { type: 'string' },
    labelsJson: { type: 'string' },
    annotationsJson: { type: 'string' },
  },
} as const

const prometheusRuleItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    type: { type: 'string' },
    health: { type: 'string' },
    query: { type: 'string' },
    duration: { type: 'string' },
    labelsJson: { type: 'string' },
    activeAlertCount: { type: 'number' },
  },
} as const

const alertmanagerAlertItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fingerprint: { type: 'string' },
    startsAt: { type: 'string' },
    endsAt: { type: 'string' },
    statusJson: { type: 'string' },
    labelsJson: { type: 'string' },
    annotationsJson: { type: 'string' },
    receiversJson: { type: 'string' },
  },
} as const

const alertmanagerGroupItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    receiver: { type: 'string' },
    labelsJson: { type: 'string' },
    alertCount: { type: 'number' },
    alertsJson: { type: 'string' },
  },
} as const

const alertmanagerSilenceItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    createdBy: { type: 'string' },
    comment: { type: 'string' },
    startsAt: { type: 'string' },
    endsAt: { type: 'string' },
    matchersJson: { type: 'string' },
    statusJson: { type: 'string' },
  },
} as const

interface JsonParseResult<T> {
  ok: boolean
  value?: T
  reason?: string
}

function parseJsonArray(value: string | undefined): JsonParseResult<unknown[]> {
  if (value === undefined || value.trim() === '') return { ok: false, reason: 'Expected a JSON array.' }
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return { ok: true, value: parsed }
    return { ok: false, reason: 'Expected a JSON array.' }
  } catch {
    return { ok: false, reason: 'Expected a valid JSON array.' }
  }
}

function isValidMatcher(value: unknown): boolean {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
  return Boolean(record && typeof record.name === 'string' && typeof record.value === 'string')
}

function isValidAlert(value: unknown): boolean {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
  return Boolean(record && record.labels && typeof record.labels === 'object' && !Array.isArray(record.labels))
}

function unavailable(reason: string) {
  return { connected: false, reason }
}

function text(textValue: string) {
  return [{ type: 'text' as const, text: textValue }]
}

function renderQuery(value: { connected?: boolean; reason?: string; resultType?: string; seriesCount?: number; resultJson?: string }) {
  if (!value.connected) return text(value.reason ?? 'Prometheus is not configured.')
  return text(`${value.resultType ?? 'unknown'} (${value.seriesCount ?? 0} result(s))\n${value.resultJson ?? ''}`)
}

function renderTargets(value: { items?: Array<Partial<PrometheusTargetItem>> }) {
  if (!value.items?.length) return text('No Prometheus scrape targets found.')
  return text(value.items.map(target =>
    `${target.health ?? 'unknown'} ${target.scrapeUrl ?? ''}${target.lastError ? ` ${target.lastError}` : ''}`,
  ).join('\n'))
}

function renderPrometheusAlerts(items: Array<Partial<PrometheusAlertItem>>) {
  if (!items.length) return text('No Prometheus alerts found.')
  return text(items.map(alert =>
    `${alert.state ?? 'unknown'} ${alert.labelsJson ?? '{}'} ${alert.value ?? ''}`,
  ).join('\n'))
}

function renderRules(items: Array<Partial<PrometheusRuleItem>>) {
  if (!items.length) return text('No Prometheus rules found.')
  return text(items.map(rule =>
    `${rule.type ?? 'unknown'} ${rule.name ?? ''} ${rule.health ?? ''} active=${rule.activeAlertCount ?? 0}`,
  ).join('\n'))
}

function renderStrings(value: { connected?: boolean; reason?: string; items?: string[] }, empty: string) {
  if (!value.connected) return text(value.reason ?? 'Prometheus is not configured.')
  return text(value.items?.length ? value.items.join(', ') : empty)
}

function renderAlertmanagerAlerts(items: Array<Partial<AlertmanagerAlertItem>>) {
  if (!items.length) return text('No Alertmanager alerts found.')
  return text(items.map(alert =>
    `${alert.labelsJson ?? '{}'} status=${alert.statusJson ?? '{}'} receiver=${alert.receiversJson ?? '[]'}`,
  ).join('\n'))
}

function renderAlertGroups(items: Array<Partial<AlertmanagerGroupItem>>) {
  if (!items.length) return text('No Alertmanager alert groups found.')
  return text(items.map(group =>
    `${group.receiver ?? ''} ${group.labelsJson ?? '{}'} alerts=${group.alertCount ?? 0}`,
  ).join('\n'))
}

function renderSilences(items: Array<Partial<AlertmanagerSilenceItem>>) {
  if (!items.length) return text('No Alertmanager silences found.')
  return text(items.map(silence =>
    `${silence.id ?? ''} ${silence.createdBy ?? ''} ${silence.matchersJson ?? '[]'} ${silence.startsAt ?? ''} -> ${silence.endsAt ?? ''} ${silence.comment ?? ''}`,
  ).join('\n'))
}

function renderLokiQuery(value: Partial<LokiQueryData> & { reason?: string }) {
  if (!value.connected) return text(value.reason ?? 'Loki is not configured.')
  return text(`${value.resultType ?? 'unknown'} (${value.seriesCount ?? 0} stream(s), ${value.entryCount ?? 0} entries)\n${value.resultJson ?? ''}`)
}

function renderLokiStrings(value: { connected?: boolean; reason?: string; items?: string[] }, empty: string) {
  if (!value.connected) return text(value.reason ?? 'Loki is not configured.')
  return text(value.items?.length ? value.items.join(', ') : empty)
}

function renderLokiSeries(items: Array<Partial<LokiSeriesItem>>) {
  if (!items.length) return text('No Loki streams found.')
  return text(items.map(item => item.labelsJson ?? '').join('\n'))
}

function renderLokiIndexStats(value: Partial<LokiIndexStats> & { reason?: string }) {
  if (!value.connected) return text(value.reason ?? 'Loki is not configured.')
  return text(`streams: ${value.streams ?? 0}\nchunks: ${value.chunks ?? 0}\nentries: ${value.entries ?? 0}\nbytes: ${value.bytes ?? 0}\n${value.statsJson ?? ''}`)
}

function renderLokiStatus(value: Partial<LokiStatusData> & { reason?: string }) {
  if (!value.connected) return text(value.reason ?? 'Loki is not configured.')
  return text(`version: ${value.version ?? ''}\nrevision: ${value.revision ?? ''}\nbranch: ${value.branch ?? ''}\nbuildDate: ${value.buildDate ?? ''}\ngoVersion: ${value.goVersion ?? ''}\n${value.statusJson ?? ''}`)
}

function renderLokiRules(items: Array<Partial<LokiRuleItem>>) {
  if (!items.length) return text('No Loki rules found.')
  return text(items.map(rule =>
    `${rule.group ?? ''}/${rule.file ?? ''} ${rule.type ?? 'unknown'} ${rule.name ?? ''} health=${rule.health ?? ''} active=${rule.activeAlertCount ?? 0}`,
  ).join('\n'))
}

function renderLokiAlerts(items: Array<Partial<LokiAlertItem>>) {
  if (!items.length) return text('No Loki alerts found.')
  return text(items.map(alert =>
    `${alert.state ?? 'unknown'} ${alert.labelsJson ?? '{}'} ${alert.value ?? ''}`,
  ).join('\n'))
}

function renderLokiVolume(value: Partial<LokiVolumeData> & { reason?: string }) {
  if (!value.connected) return text(value.reason ?? 'Loki is not configured.')
  return text(`${value.resultType ?? 'unknown'} (${value.seriesCount ?? 0} series, ${value.totalBytes ?? 0} bytes)\n${value.resultJson ?? ''}`)
}

function renderLokiPatterns(items: Array<Partial<LokiPatternItem>>) {
  if (!items.length) return text('No Loki patterns found.')
  return text(items.map(pattern =>
    `${pattern.pattern ?? ''} samples=${pattern.sampleCount ?? 0} total=${pattern.totalCount ?? 0}`,
  ).join('\n'))
}

function renderGrafanaHealth(value: Partial<GrafanaHealthData> & { reason?: string }) {
  if (!value.connected) return text(value.reason ?? 'Grafana is not configured.')
  return text(`database: ${value.database ?? ''}\nversion: ${value.version ?? ''}\ncommit: ${value.commit ?? ''}\n${value.statusJson ?? ''}`)
}

function renderGrafanaDatasource(item?: Partial<GrafanaDatasourceItem>) {
  if (!item?.name) return text('No Grafana datasource found.')
  return text(`${item.name} (${item.type ?? 'unknown'})\nurl: ${item.url ?? ''}\naccess: ${item.access ?? ''}\ndefault: ${item.isDefault ? 'yes' : 'no'}`)
}

function renderGrafanaDatasources(items: Array<Partial<GrafanaDatasourceItem>>) {
  if (!items.length) return text('No Grafana datasources found.')
  return text(items.map(item =>
    `${item.name ?? ''} (${item.type ?? 'unknown'}) ${item.url ?? ''} default=${item.isDefault ? 'yes' : 'no'}`,
  ).join('\n'))
}

function renderGrafanaDashboards(items: Array<Partial<GrafanaDashboardSummaryItem>>) {
  if (!items.length) return text('No Grafana dashboards found.')
  return text(items.map(item =>
    `${item.title ?? ''} ${item.url ?? ''}${item.folderTitle ? ` folder=${item.folderTitle}` : ''}`,
  ).join('\n'))
}

function renderGrafanaDashboard(value: Partial<GrafanaDashboardData> & { reason?: string }) {
  if (!value.connected) return text(value.reason ?? 'Grafana is not configured.')
  return text(`${value.title ?? ''} ${value.url ?? ''}\npanels: ${value.panelCount ?? 0}\n${value.dashboardJson ?? ''}`)
}

function renderGrafanaFolders(items: Array<Partial<GrafanaFolderItem>>) {
  if (!items.length) return text('No Grafana folders found.')
  return text(items.map(item => `${item.title ?? ''} ${item.url ?? ''}`).join('\n'))
}
