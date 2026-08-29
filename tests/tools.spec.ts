import { describe, expect, it, vi } from 'vitest'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { MonitoringClient } from '../src/client.ts'
import { createTools } from '../src/index.ts'

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

function exec(): ToolRunContext {
  return { signal: new AbortController().signal } as unknown as ToolRunContext
}

function tools(client = new MonitoringClient()) {
  return Object.fromEntries(createTools(client).map(tool => [tool.name, tool]))
}

describe('tool definitions', () => {
  it('registers the planned Prometheus and Alertmanager tool set', () => {
    expect(Object.keys(tools()).sort()).toEqual([
      'alertmanager_create_silence',
      'alertmanager_delete_silence',
      'alertmanager_get_status',
      'alertmanager_list_alert_groups',
      'alertmanager_list_alerts',
      'alertmanager_list_receivers',
      'alertmanager_list_silences',
      'alertmanager_send_alerts',
      'grafana_get_dashboard',
      'grafana_get_datasource',
      'grafana_get_health',
      'grafana_list_alert_instances',
      'grafana_list_annotations',
      'grafana_list_datasources',
      'grafana_list_folders',
      'grafana_search_dashboards',
      'loki_get_detected_field_values',
      'loki_get_detected_fields',
      'loki_get_index_stats',
      'loki_get_index_volume',
      'loki_get_index_volume_range',
      'loki_get_label_values',
      'loki_get_patterns',
      'loki_get_status',
      'loki_list_alerts',
      'loki_list_labels',
      'loki_list_rule_groups',
      'loki_list_rules',
      'loki_list_series',
      'loki_query',
      'loki_query_range',
      'prometheus_delete_series',
      'prometheus_get_label_values',
      'prometheus_get_tsdb_status',
      'prometheus_list_alerts',
      'prometheus_list_labels',
      'prometheus_list_rules',
      'prometheus_list_series',
      'prometheus_list_targets',
      'prometheus_query',
      'prometheus_query_range',
    ])
  })

  it('returns connected business values when component URLs are disabled', async () => {
    const client = new MonitoringClient({
      prometheusBaseUrl: '',
      alertmanagerBaseUrl: '',
      lokiBaseUrl: '',
      grafanaBaseUrl: '',
      fetchImpl: vi.fn(),
    })
    const map = tools(client)

    expect(await map.prometheus_query.execute({ query: 'up' }, exec())).toMatchObject({
      connected: false,
      reason: 'Prometheus base URL is not configured.',
    })
    expect(await map.alertmanager_list_alerts.execute({}, exec())).toMatchObject({
      connected: false,
      reason: 'Alertmanager base URL is not configured.',
    })
    expect(await map.loki_query.execute({ query: '{job="app"}' }, exec())).toMatchObject({
      connected: false,
      reason: 'Loki base URL is not configured.',
    })
    expect(await map.grafana_get_health.execute({}, exec())).toMatchObject({
      connected: false,
      reason: 'Grafana base URL is not configured.',
    })
  })

  it('executes a Prometheus query and forwards the request', async () => {
    const fetchImpl = vi.fn(async () => json({
      status: 'success',
      data: { resultType: 'vector', result: [{ metric: { __name__: 'up' }, value: [1700000000, '1'] }] },
    }))
    const map = tools(new MonitoringClient({ prometheusBaseUrl: 'http://prom:9090', fetchImpl }))
    const result = await map.prometheus_query.execute({ query: 'up' }, exec())

    expect(result).toMatchObject({ connected: true, resultType: 'vector', seriesCount: 1 })
    expect(fetchImpl.mock.calls[0][0]).toBe('http://prom:9090/api/v1/query?query=up')
  })

  it('executes a Loki query range and forwards the request', async () => {
    const fetchImpl = vi.fn(async () => json({
      status: 'success',
      data: {
        resultType: 'streams',
        result: [{
          stream: { app: 'api' },
          values: [['1700000000000000000', 'hello']],
        }],
      },
    }))
    const map = tools(new MonitoringClient({ lokiBaseUrl: 'http://loki:3100', fetchImpl }))
    const result = await map.loki_query_range.execute({
      query: '{app="api"}',
      start: '1700000000',
      end: '1700003600',
    }, exec())

    expect(result).toMatchObject({ connected: true, resultType: 'streams', seriesCount: 1, entryCount: 1 })
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'http://loki:3100/loki/api/v1/query_range?query=%7Bapp%3D%22api%22%7D&start=1700000000&end=1700003600',
    )
  })

  it('executes Loki rule, alert, volume, and pattern read tools', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('ns1:\n- name: group-a\n', {
        status: 200,
        headers: { 'content-type': 'application/yaml' },
      }))
      .mockResolvedValueOnce(json({
        status: 'success',
        data: {
          groups: [{
            name: 'group-a',
            file: 'rules.yaml',
            rules: [{
              name: 'cpu_high',
              type: 'alerting',
              health: 'ok',
              lastError: '',
              query: 'sum(rate({job="app"}[5m]))',
              duration: '5m',
              labels: {},
              annotations: {},
              alerts: [],
            }],
          }],
        },
      }))
      .mockResolvedValueOnce(json({
        status: 'success',
        data: {
          alerts: [{
            state: 'firing',
            value: '1e+00',
            activeAt: '2026-08-28T00:00:00Z',
            labels: { alertname: 'HighCPU' },
            annotations: {},
          }],
        },
      }))
      .mockResolvedValueOnce(json({
        status: 'success',
        data: {
          resultType: 'vector',
          result: [{ metric: { job: 'app' }, value: [1700000000, '2048'] }],
        },
      }))
      .mockResolvedValueOnce(json({
        status: 'success',
        data: {
          resultType: 'matrix',
          result: [{ metric: { job: 'app' }, values: [[1700000000, '1024']] }],
        },
      }))
      .mockResolvedValueOnce(json({
        status: 'success',
        data: [{ pattern: 'level=info <_>', samples: [[1711839260, 1], [1711839270, 2]] }],
      }))
    const map = tools(new MonitoringClient({ lokiBaseUrl: 'http://loki:3100', fetchImpl }))

    expect((await map.loki_list_rule_groups.execute({}, exec())).ruleGroupsYaml).toContain('group-a')
    expect((await map.loki_list_rules.execute({}, exec())).items).toHaveLength(1)
    expect((await map.loki_list_alerts.execute({}, exec())).items).toHaveLength(1)
    expect(await map.loki_get_index_volume.execute({
      query: '{job="app"}',
      start: '1700000000',
      end: '1700003600',
    }, exec())).toMatchObject({ connected: true, totalBytes: 2048 })
    expect(await map.loki_get_index_volume_range.execute({
      query: '{job="app"}',
      start: '1700000000',
      end: '1700003600',
      step: '60s',
    }, exec())).toMatchObject({ connected: true, totalBytes: 1024 })
    expect((await map.loki_get_patterns.execute({
      query: '{job="app"}',
      start: '1711839260',
      end: '1711839280',
    }, exec())).items[0].totalCount).toBe(3)
    expect(fetchImpl.mock.calls.length).toBe(6)
  })

  it('executes Grafana read tools and forwards requests', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ database: 'ok', version: '11.2.0', commit: 'abc123' }))
      .mockResolvedValueOnce(json([{
        id: 1,
        uid: 'ds-1',
        name: 'Prometheus',
        type: 'prometheus',
        url: 'http://prom:9090',
        access: 'proxy',
        isDefault: true,
        basicAuth: false,
        withCredentials: false,
        database: '',
        user: '',
      }]))
      .mockResolvedValueOnce(json({
        id: 1,
        uid: 'ds-1',
        name: 'Prometheus',
        type: 'prometheus',
        url: 'http://prom:9090',
        access: 'proxy',
        isDefault: true,
        basicAuth: false,
        withCredentials: false,
        database: '',
        user: '',
      }))
      .mockResolvedValueOnce(json([{
        id: 10,
        uid: 'dash-1',
        title: 'Overview',
        url: '/d/dash-1/overview',
        type: 'dash-db',
        tags: ['prod'],
        isStarred: false,
        folderUid: 'folder-1',
        folderTitle: 'Ops',
      }]))
      .mockResolvedValueOnce(json({
        dashboard: {
          uid: 'dash-1',
          title: 'Overview',
          url: '/d/dash-1/overview',
          panels: [{ id: 1 }],
        },
        meta: { url: '/d/dash-1/overview' },
      }))
      .mockResolvedValueOnce(json([{
        id: 1,
        uid: 'folder-1',
        title: 'Ops',
        url: '/dashboards/f/folder-1/ops',
      }]))
    const map = tools(new MonitoringClient({ grafanaBaseUrl: 'http://grafana:3000', fetchImpl }))

    expect(await map.grafana_get_health.execute({}, exec())).toMatchObject({
      connected: true,
      version: '11.2.0',
    })
    expect((await map.grafana_list_datasources.execute({}, exec())).items).toHaveLength(1)
    expect((await map.grafana_get_datasource.execute({ uid: 'ds-1' }, exec())).item.name).toBe('Prometheus')
    expect((await map.grafana_search_dashboards.execute({ query: 'prod' }, exec())).items[0].uid).toBe('dash-1')
    expect(await map.grafana_get_dashboard.execute({ uid: 'dash-1' }, exec())).toMatchObject({
      connected: true,
      panelCount: 1,
    })
    expect((await map.grafana_list_folders.execute({}, exec())).items[0].uid).toBe('folder-1')
    expect(fetchImpl.mock.calls.length).toBe(6)
  })

  it('executes Loki detected field and Grafana alert observation tools', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({
        status: 'success',
        data: {
          fields: [{
            label: 'level',
            type: 'string',
            cardinality: 3,
            parsers: ['logfmt'],
            jsonPath: '',
          }],
          limit: 100,
        },
      }))
      .mockResolvedValueOnce(json({
        status: 'success',
        data: { values: ['debug', 'info'], limit: 50 },
      }))
      .mockResolvedValueOnce(json([{
        id: 1,
        alertId: 0,
        dashboardUID: 'dash-1',
        panelId: 1,
        userId: 1,
        userName: 'alice',
        newState: '',
        prevState: '',
        time: 1507266395000,
        timeEnd: 1507266395000,
        text: 'deploy',
        tags: ['prod'],
        data: {},
      }]))
      .mockResolvedValueOnce(json([{
        fingerprint: 'abc',
        startsAt: '2026-08-28T00:00:00Z',
        endsAt: '0001-01-01T00:00:00Z',
        status: { state: 'active' },
        labels: { alertname: 'HighCPU' },
        annotations: {},
        receivers: [{ name: 'webhook' }],
      }]))
    const map = tools(new MonitoringClient({
      lokiBaseUrl: 'http://loki:3100',
      grafanaBaseUrl: 'http://grafana:3000',
      fetchImpl,
    }))

    expect((await map.loki_get_detected_fields.execute({
      query: '{job="app"}',
      start: '1700000000',
      end: '1700003600',
    }, exec())).items[0]).toMatchObject({ label: 'level', cardinality: 3 })
    expect((await map.loki_get_detected_field_values.execute({
      fieldName: 'level',
      query: '{job="app"}',
    }, exec())).items).toEqual(['debug', 'info'])
    expect((await map.grafana_list_annotations.execute({
      tagsJson: '["prod","api"]',
      dashboardUid: 'dash-1',
    }, exec())).items[0].text).toBe('deploy')
    expect((await map.grafana_list_alert_instances.execute({
      active: false,
      receiver: 'webhook',
    }, exec())).items[0].fingerprint).toBe('abc')
    expect(await map.grafana_list_annotations.execute({ tagsJson: 'not-json' }, exec())).toMatchObject({
      connected: false,
      reason: 'tagsJson must be a valid JSON array.',
    })
    expect(fetchImpl.mock.calls.length).toBe(4)
  })

  it('keeps all write tools gated when allowWrite is not enabled', async () => {
    const fetchImpl = vi.fn()
    const map = tools(new MonitoringClient({ fetchImpl }))

    expect(await map.prometheus_delete_series.execute({ matchersJson: '["up"]' }, exec())).toMatchObject({ ok: false })
    expect(await map.alertmanager_create_silence.execute({
      matchersJson: '[{"name":"severity","value":"critical"}]',
      startsAt: '2026-08-28T00:00:00Z',
      endsAt: '2026-08-28T01:00:00Z',
      createdBy: 'bot',
      comment: 'maintenance',
    }, exec())).toMatchObject({ ok: false })
    expect(await map.alertmanager_delete_silence.execute({ silenceId: 'sil-1' }, exec())).toMatchObject({ ok: false })
    expect(await map.alertmanager_send_alerts.execute({ alertsJson: '[{"labels":{"alertname":"X"}}]' }, exec())).toMatchObject({ ok: false })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('validates JSON array inputs before write execution', async () => {
    const map = tools(new MonitoringClient({ allowWrite: true, fetchImpl: vi.fn() }))

    expect(await map.prometheus_delete_series.execute({ matchersJson: 'not-json' }, exec())).toMatchObject({
      ok: false,
      reason: 'matchersJson must be a valid JSON array.',
    })
    expect(await map.alertmanager_create_silence.execute({
      matchersJson: '[{"name":"severity"}]',
      startsAt: 'x',
      endsAt: 'y',
      createdBy: 'bot',
      comment: 'c',
    }, exec())).toMatchObject({
      ok: false,
      reason: 'matchersJson must contain matcher objects with name and value strings.',
    })
    expect(await map.alertmanager_send_alerts.execute({ alertsJson: '[{"labels":"bad"}]' }, exec())).toMatchObject({
      ok: false,
      reason: 'alertsJson must contain alert objects with labels objects.',
    })
  })

  it('validates Loki series selector JSON and renders Loki results', async () => {
    const map = tools()

    expect(await map.loki_list_series.execute({ matchesJson: 'not-json' }, exec())).toMatchObject({
      connected: false,
      reason: 'matchesJson must be a valid JSON array.',
    })

    const queryRender = await (map.loki_query.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      connected: true,
      resultType: 'streams',
      seriesCount: 1,
      entryCount: 1,
      resultJson: '[]',
    })
    expect(JSON.stringify(queryRender)).toContain('1 stream(s), 1 entries')
  })

  it('renders query and alert lists into readable text', async () => {
    const map = tools()
    const queryRender = await (map.prometheus_query.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      connected: true,
      resultType: 'vector',
      seriesCount: 1,
      resultJson: '[{"metric":{"__name__":"up"},"value":[1,"1"]}]',
    })
    expect(JSON.stringify(queryRender)).toContain('vector (1 result(s))')

    const groupsRender = await (map.alertmanager_list_alert_groups.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      connected: true,
      items: [{ receiver: 'webhook', labelsJson: '{"alertname":"X"}', alertCount: 2, alertsJson: '[]' }],
    })
    expect(JSON.stringify(groupsRender)).toContain('webhook')
  })

  it('presents read and write tool calls', () => {
    const map = tools()
    expect(map.prometheus_query.presentCall!({ query: 'up' })).toMatchObject({ kind: 'search' })
    expect(map.prometheus_list_targets.presentResult!({}, { connected: true, activeCount: 3 })).toMatchObject({
      title: '3 active target(s)',
    })
    expect(map.alertmanager_create_silence.presentCall!({
      matchersJson: '[{"name":"severity","value":"critical"}]',
      startsAt: '2026-08-28T00:00:00Z',
      endsAt: '2026-08-28T01:00:00Z',
      createdBy: 'bot',
      comment: 'maintenance',
    })).toMatchObject({ kind: 'edit' })
    expect(map.loki_query.presentCall!({ query: '{app="api"}' })).toMatchObject({ kind: 'search' })
    expect(map.alertmanager_delete_silence.presentResult!({ silenceId: 'sil-1' }, { ok: true })).toMatchObject({
      title: 'Silence deleted',
    })
  })
})
