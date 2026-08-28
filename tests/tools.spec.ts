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
    expect(map.alertmanager_delete_silence.presentResult!({ silenceId: 'sil-1' }, { ok: true })).toMatchObject({
      title: 'Silence deleted',
    })
  })
})
