/** Minimal Prometheus and Alertmanager HTTP clients with injected fetch for testability. */

export interface MonitoringClientOptions {
  /** Prometheus HTTP API base URL, default http://localhost:9090. */
  prometheusBaseUrl?: string
  /** Prometheus bearer token. Used directly when the value already starts with "Bearer ". */
  prometheusToken?: string
  prometheusUsername?: string
  prometheusPassword?: string
  /** Alertmanager HTTP API base URL, default http://localhost:9093. */
  alertmanagerBaseUrl?: string
  /** Alertmanager bearer token. Used directly when the value already starts with "Bearer ". */
  alertmanagerToken?: string
  alertmanagerUsername?: string
  alertmanagerPassword?: string
  /** Request timeout in milliseconds. 0 disables the timeout. */
  timeoutMs?: number
  /** Write tools stay disabled unless this is true. */
  allowWrite?: boolean
  fetchImpl?: typeof fetch
}

export interface PrometheusQueryData {
  connected: boolean
  resultType: string
  seriesCount: number
  resultJson: string
}

export interface PrometheusTargetItem {
  scrapeUrl: string
  health: string
  lastError: string
  labelsJson: string
}

export interface PrometheusTargetData {
  connected: boolean
  activeCount: number
  droppedCount: number
  items: PrometheusTargetItem[]
}

export interface PrometheusAlertItem {
  state: string
  value: string
  activeAt: string
  labelsJson: string
  annotationsJson: string
}

export interface PrometheusRuleItem {
  name: string
  type: string
  health: string
  query: string
  duration: string
  labelsJson: string
  activeAlertCount: number
}

export interface PrometheusSeriesItem {
  labelsJson: string
}

export interface PrometheusLabelData {
  connected: boolean
  items: string[]
}

export interface PrometheusTsdbData {
  connected: boolean
  headSeriesCount: number
  statsJson: string
}

export interface AlertmanagerAlertItem {
  fingerprint: string
  startsAt: string
  endsAt: string
  statusJson: string
  labelsJson: string
  annotationsJson: string
  receiversJson: string
}

export interface AlertmanagerGroupItem {
  receiver: string
  labelsJson: string
  alertCount: number
  alertsJson: string
}

export interface AlertmanagerSilenceItem {
  id: string
  createdBy: string
  comment: string
  startsAt: string
  endsAt: string
  matchersJson: string
  statusJson: string
}

export interface AlertmanagerReceiverItem {
  name: string
}

export interface MonitoringWriteResult {
  ok: boolean
  reason?: string
  id?: string
}

export class MonitoringError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'MonitoringError'
  }
}

type Component = 'prometheus' | 'alertmanager'
type HttpMethod = 'GET' | 'POST' | 'DELETE'

interface ComponentOptions {
  baseUrl: string
  token?: string
  username?: string
  password?: string
}

interface PrometheusData {
  resultType?: string
  result?: unknown
  activeTargets?: unknown
  droppedTargets?: unknown
  alerts?: unknown
  groups?: unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

function asNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  return typeof value === 'number' ? value : 0
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? {})
}

function isInfrastructureError(error: unknown): boolean {
  return error instanceof MonitoringError
    && (error.status === 401 || error.status === 403 || error.status === 429 || error.status >= 500)
}

function writeDisabledReason(): string {
  return 'Write operations are disabled. Set allowWrite: true in the plugin config.'
}

function mapQueryData(data: unknown): PrometheusQueryData {
  const record = asRecord(data)
  const result = asArray(record.result)
  return {
    connected: true,
    resultType: asString(record, 'resultType'),
    seriesCount: result.length,
    resultJson: JSON.stringify(result),
  }
}

function mapTarget(data: unknown): PrometheusTargetItem {
  const record = asRecord(data)
  return {
    scrapeUrl: asString(record, 'scrapeUrl'),
    health: asString(record, 'health'),
    lastError: asString(record, 'lastError'),
    labelsJson: toJson(record.labels),
  }
}

export class MonitoringClient {
  private readonly prometheus: ComponentOptions
  private readonly alertmanager: ComponentOptions
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly allowWrite: boolean

  constructor(options: MonitoringClientOptions = {}) {
    this.prometheus = {
      baseUrl: (options.prometheusBaseUrl ?? 'http://localhost:9090').replace(/\/+$/, ''),
      token: options.prometheusToken,
      username: options.prometheusUsername,
      password: options.prometheusPassword,
    }
    this.alertmanager = {
      baseUrl: (options.alertmanagerBaseUrl ?? 'http://localhost:9093').replace(/\/+$/, ''),
      token: options.alertmanagerToken,
      username: options.alertmanagerUsername,
      password: options.alertmanagerPassword,
    }
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? 15_000
    this.allowWrite = options.allowWrite ?? false
  }

  hasPrometheus(): boolean {
    return this.prometheus.baseUrl.length > 0
  }

  hasAlertmanager(): boolean {
    return this.alertmanager.baseUrl.length > 0
  }

  private combinedSignal(signal?: AbortSignal): AbortSignal | undefined {
    if (this.timeoutMs <= 0) return signal
    const timeout = AbortSignal.timeout(this.timeoutMs)
    return signal ? AbortSignal.any([signal, timeout]) : timeout
  }

  private headers(component: Component): Record<string, string> {
    const options = component === 'prometheus' ? this.prometheus : this.alertmanager
    const headers: Record<string, string> = {
      accept: 'application/json',
      'user-agent': 'dsh-tool-monitoring',
    }
    if (options.token) {
      headers.authorization = options.token.startsWith('Bearer ')
        ? options.token
        : `Bearer ${options.token}`
    } else if (options.username || options.password) {
      headers.authorization = `Basic ${Buffer.from(`${options.username ?? ''}:${options.password ?? ''}`).toString('base64')}`
    }
    return headers
  }

  private async request(
    component: Component,
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const options = component === 'prometheus' ? this.prometheus : this.alertmanager
    const response = await this.fetchImpl(`${options.baseUrl}${path}`, {
      method,
      headers: this.headers(component),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: this.combinedSignal(signal),
    })

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      payload = undefined
    }

    if (!response.ok) {
      const message = asString(asRecord(payload), 'message') || `HTTP ${response.status}`
      throw new MonitoringError(message, response.status)
    }
    return payload
  }

  private async prometheusRequest(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const payload = await this.request('prometheus', method, path, body, signal)
    const record = asRecord(payload)
    if (record.status === 'error') {
      const errorType = asString(record, 'errorType')
      const message = asString(record, 'error') || 'Prometheus API error'
      throw new MonitoringError(errorType ? `${errorType}: ${message}` : message, 400)
    }
    if (record.status === 'success' && 'data' in record) return record.data
    return payload
  }

  private async alertmanagerRequest(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    return this.request('alertmanager', method, path, body, signal)
  }

  async query(
    query: string,
    options: { time?: string; signal?: AbortSignal } = {},
  ): Promise<PrometheusQueryData> {
    const queryPart = `query=${encodeURIComponent(query)}`
    const timePart = options.time ? `&time=${encodeURIComponent(options.time)}` : ''
    const data = await this.prometheusRequest('GET', `/api/v1/query?${queryPart}${timePart}`, undefined, options.signal)
    return mapQueryData(data)
  }

  async queryRange(
    query: string,
    options: {
      start: string
      end: string
      step: string
      signal?: AbortSignal
    },
  ): Promise<PrometheusQueryData> {
    const data = await this.prometheusRequest(
      'GET',
      `/api/v1/query_range?query=${encodeURIComponent(query)}&start=${encodeURIComponent(options.start)}&end=${encodeURIComponent(options.end)}&step=${encodeURIComponent(options.step)}`,
      undefined,
      options.signal,
    )
    return mapQueryData(data)
  }

  async listTargets(options: { signal?: AbortSignal } = {}): Promise<PrometheusTargetData> {
    const data = asRecord(await this.prometheusRequest('GET', '/api/v1/targets', undefined, options.signal))
    const active = asArray(data.activeTargets)
    const dropped = asArray(data.droppedTargets)
    return {
      connected: true,
      activeCount: active.length,
      droppedCount: dropped.length,
      items: active.map(mapTarget),
    }
  }

  async listAlerts(options: { signal?: AbortSignal } = {}): Promise<{
    connected: boolean
    items: PrometheusAlertItem[]
  }> {
    const data = asRecord(await this.prometheusRequest('GET', '/api/v1/alerts', undefined, options.signal))
    const items = asArray(data.alerts).map(alert => {
      const record = asRecord(alert)
      return {
        state: asString(record, 'state'),
        value: asString(record, 'value'),
        activeAt: asString(record, 'activeAt'),
        labelsJson: toJson(record.labels),
        annotationsJson: toJson(record.annotations),
      }
    })
    return { connected: true, items }
  }

  async listRules(options: { signal?: AbortSignal } = {}): Promise<{
    connected: boolean
    items: PrometheusRuleItem[]
  }> {
    const data = asRecord(await this.prometheusRequest('GET', '/api/v1/rules', undefined, options.signal))
    const items: PrometheusRuleItem[] = []
    for (const rawGroup of asArray(data.groups)) {
      const group = asRecord(rawGroup)
      for (const rawRule of asArray(group.rules)) {
        const rule = asRecord(rawRule)
        const activeAlerts = asArray(rule.alerts)
        items.push({
          name: asString(rule, 'name'),
          type: asString(rule, 'type'),
          health: asString(rule, 'health'),
          query: asString(rule, 'query'),
          duration: asString(rule, 'duration'),
          labelsJson: toJson(rule.labels),
          activeAlertCount: activeAlerts.length,
        })
      }
    }
    return { connected: true, items }
  }

  async listSeries(
    match: string,
    options: { start?: string; end?: string; signal?: AbortSignal } = {},
  ): Promise<{
    connected: boolean
    items: PrometheusSeriesItem[]
  }> {
    let path = `/api/v1/series?match[]=${encodeURIComponent(match)}`
    if (options.start) path += `&start=${encodeURIComponent(options.start)}`
    if (options.end) path += `&end=${encodeURIComponent(options.end)}`
    const data = await this.prometheusRequest('GET', path, undefined, options.signal)
    const items = asArray(data).map(series => ({ labelsJson: toJson(series) }))
    return { connected: true, items }
  }

  async listLabels(options: { signal?: AbortSignal } = {}): Promise<PrometheusLabelData> {
    const data = await this.prometheusRequest('GET', '/api/v1/labels', undefined, options.signal)
    return {
      connected: true,
      items: asArray(data).map(value => typeof value === 'string' ? value : String(value ?? '')),
    }
  }

  async getLabelValues(labelName: string, options: { signal?: AbortSignal } = {}): Promise<PrometheusLabelData> {
    const data = await this.prometheusRequest(
      'GET',
      `/api/v1/label/${encodeURIComponent(labelName)}/values`,
      undefined,
      options.signal,
    )
    return {
      connected: true,
      items: asArray(data).map(value => typeof value === 'string' ? value : String(value ?? '')),
    }
  }

  async getTsdbStatus(options: { signal?: AbortSignal } = {}): Promise<PrometheusTsdbData> {
    const data = await this.prometheusRequest('GET', '/api/v1/status/tsdb', undefined, options.signal)
    const record = asRecord(data)
    const headStats = asRecord(record.headStats)
    return {
      connected: true,
      headSeriesCount: asNumber(headStats, 'numSeries'),
      statsJson: JSON.stringify(data ?? {}),
    }
  }

  async deleteSeries(
    matchers: string[],
    options: { start?: string; end?: string; signal?: AbortSignal } = {},
  ): Promise<MonitoringWriteResult> {
    if (!this.allowWrite) return { ok: false, reason: writeDisabledReason() }
    try {
      const params = matchers.map(matcher => `match[]=${encodeURIComponent(matcher)}`).join('&')
      let path = `/api/v1/admin/tsdb/delete_series?${params}`
      if (options.start) path += `&start=${encodeURIComponent(options.start)}`
      if (options.end) path += `&end=${encodeURIComponent(options.end)}`
      await this.prometheusRequest('POST', path, undefined, options.signal)
      return { ok: true }
    } catch (error) {
      if (isInfrastructureError(error)) throw error
      return { ok: false, reason: error instanceof MonitoringError ? error.message : 'Could not delete Prometheus series.' }
    }
  }

  async getAlertmanagerStatus(options: { signal?: AbortSignal } = {}): Promise<{
    connected: boolean
    uptime: string
    version: string
    statusJson: string
  }> {
    const data = await this.alertmanagerRequest('GET', '/api/v2/status', undefined, options.signal)
    const record = asRecord(data)
    const versionInfo = asRecord(record.versionInfo)
    return {
      connected: true,
      uptime: asString(record, 'uptime'),
      version: asString(versionInfo, 'version'),
      statusJson: JSON.stringify(data ?? {}),
    }
  }

  async listAlertmanagerAlerts(
    options: {
      filter?: string
      active?: boolean
      silenced?: boolean
      inhibited?: boolean
      receiver?: string
      signal?: AbortSignal
    } = {},
  ): Promise<{
    connected: boolean
    items: AlertmanagerAlertItem[]
  }> {
    const params: string[] = []
    if (options.filter) params.push(`filter=${encodeURIComponent(options.filter)}`)
    if (options.active === false) params.push('active=false')
    if (options.silenced === false) params.push('silenced=false')
    if (options.inhibited === false) params.push('inhibited=false')
    if (options.receiver) params.push(`receiver=${encodeURIComponent(options.receiver)}`)
    const suffix = params.length > 0 ? `?${params.join('&')}` : ''
    const data = await this.alertmanagerRequest('GET', `/api/v2/alerts${suffix}`, undefined, options.signal)
    const items = asArray(data).map(alert => {
      const record = asRecord(alert)
      return {
        fingerprint: asString(record, 'fingerprint'),
        startsAt: asString(record, 'startsAt'),
        endsAt: asString(record, 'endsAt'),
        statusJson: toJson(record.status),
        labelsJson: toJson(record.labels),
        annotationsJson: toJson(record.annotations),
        receiversJson: toJson(record.receivers),
      }
    })
    return { connected: true, items }
  }

  async listAlertGroups(
    options: { receiver?: string; signal?: AbortSignal } = {},
  ): Promise<{
    connected: boolean
    items: AlertmanagerGroupItem[]
  }> {
    const suffix = options.receiver ? `?receiver=${encodeURIComponent(options.receiver)}` : ''
    const data = await this.alertmanagerRequest('GET', `/api/v2/alerts/groups${suffix}`, undefined, options.signal)
    const items = asArray(data).map(group => {
      const record = asRecord(group)
      const alerts = asArray(record.alerts)
      return {
        receiver: asString(record, 'receiver'),
        labelsJson: toJson(record.labels),
        alertCount: alerts.length,
        alertsJson: JSON.stringify(alerts),
      }
    })
    return { connected: true, items }
  }

  async listSilences(options: { signal?: AbortSignal } = {}): Promise<{
    connected: boolean
    items: AlertmanagerSilenceItem[]
  }> {
    const data = await this.alertmanagerRequest('GET', '/api/v2/silences', undefined, options.signal)
    const items = asArray(data).map(silence => {
      const record = asRecord(silence)
      return {
        id: asString(record, 'id'),
        createdBy: asString(record, 'createdBy'),
        comment: asString(record, 'comment'),
        startsAt: asString(record, 'startsAt'),
        endsAt: asString(record, 'endsAt'),
        matchersJson: toJson(record.matchers),
        statusJson: toJson(record.status),
      }
    })
    return { connected: true, items }
  }

  async listReceivers(options: { signal?: AbortSignal } = {}): Promise<{
    connected: boolean
    items: AlertmanagerReceiverItem[]
  }> {
    const data = await this.alertmanagerRequest('GET', '/api/v2/receivers', undefined, options.signal)
    const items = asArray(data).map(receiver => ({ name: asString(asRecord(receiver), 'name') }))
    return { connected: true, items }
  }

  async createSilence(
    input: {
      matchers: unknown[]
      startsAt: string
      endsAt: string
      createdBy: string
      comment: string
      signal?: AbortSignal
    },
  ): Promise<MonitoringWriteResult> {
    if (!this.allowWrite) return { ok: false, reason: writeDisabledReason() }
    try {
      const data = await this.alertmanagerRequest(
        'POST',
        '/api/v2/silences',
        {
          matchers: input.matchers,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          createdBy: input.createdBy,
          comment: input.comment,
        },
        input.signal,
      )
      return { ok: true, id: asString(asRecord(data), 'silenceID') || undefined }
    } catch (error) {
      if (isInfrastructureError(error)) throw error
      return { ok: false, reason: error instanceof MonitoringError ? error.message : 'Could not create Alertmanager silence.' }
    }
  }

  async deleteSilence(silenceId: string, signal?: AbortSignal): Promise<MonitoringWriteResult> {
    if (!this.allowWrite) return { ok: false, reason: writeDisabledReason() }
    try {
      await this.alertmanagerRequest('DELETE', `/api/v2/silence/${encodeURIComponent(silenceId)}`, undefined, signal)
      return { ok: true }
    } catch (error) {
      if (isInfrastructureError(error)) throw error
      return { ok: false, reason: error instanceof MonitoringError ? error.message : 'Could not delete Alertmanager silence.' }
    }
  }

  async sendAlerts(alerts: unknown[], signal?: AbortSignal): Promise<MonitoringWriteResult> {
    if (!this.allowWrite) return { ok: false, reason: writeDisabledReason() }
    try {
      await this.alertmanagerRequest('POST', '/api/v2/alerts', { alerts }, signal)
      return { ok: true }
    } catch (error) {
      if (isInfrastructureError(error)) throw error
      return { ok: false, reason: error instanceof MonitoringError ? error.message : 'Could not send Alertmanager alerts.' }
    }
  }
}
