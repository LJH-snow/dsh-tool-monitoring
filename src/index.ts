import type { Context } from '@deepseek-ai/cordis'
import type { ToolCallView, ToolResultView } from '@deepseek-ai/dsh-tools'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  MonitoringClient,
  MonitoringError,
  type AlertmanagerAlertItem,
  type AlertmanagerGroupItem,
  type AlertmanagerSilenceItem,
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
  ]
}

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
