/** Minimal Prometheus, Alertmanager, Loki, and Grafana HTTP clients with injected fetch for testability. */

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
  /** Loki HTTP API base URL, default http://localhost:3100. */
  lokiBaseUrl?: string
  /** Loki bearer token. Used directly when the value already starts with "Bearer ". */
  lokiToken?: string
  lokiUsername?: string
  lokiPassword?: string
  /** Optional Loki tenant ID for multi-tenant deployments. */
  lokiTenantId?: string
  /** Grafana HTTP API base URL, default http://localhost:3000. */
  grafanaBaseUrl?: string
  /** Grafana bearer token. Used directly when the value already starts with "Bearer ". */
  grafanaToken?: string
  grafanaUsername?: string
  grafanaPassword?: string
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

export interface LokiQueryData {
  connected: boolean
  resultType: string
  seriesCount: number
  entryCount: number
  resultJson: string
}

export interface LokiLabelData {
  connected: boolean
  items: string[]
}

export interface LokiSeriesItem {
  labelsJson: string
}

export interface LokiIndexStats {
  connected: boolean
  streams: number
  chunks: number
  entries: number
  bytes: number
  statsJson: string
}

export interface LokiStatusData {
  connected: boolean
  version: string
  revision: string
  branch: string
  buildDate: string
  goVersion: string
  statusJson: string
}

export interface LokiRuleGroupData {
  connected: boolean
  ruleGroupsYaml: string
}

export interface LokiRuleItem {
  group: string
  file: string
  name: string
  type: string
  health: string
  lastError: string
  query: string
  duration: string
  labelsJson: string
  annotationsJson: string
  activeAlertCount: number
}

export interface LokiAlertItem {
  state: string
  value: string
  activeAt: string
  labelsJson: string
  annotationsJson: string
}

export interface LokiVolumeData {
  connected: boolean
  resultType: string
  seriesCount: number
  totalBytes: number
  resultJson: string
}

export interface LokiPatternItem {
  pattern: string
  sampleCount: number
  totalCount: number
  samplesJson: string
}

export interface LokiDetectedFieldItem {
  label: string
  type: string
  cardinality: number
  parsersJson: string
  jsonPath: string
}

export interface GrafanaHealthData {
  connected: boolean
  database: string
  version: string
  commit: string
  statusJson: string
}

export interface GrafanaDatasourceItem {
  id: number
  uid: string
  name: string
  type: string
  url: string
  access: string
  isDefault: boolean
  basicAuth: boolean
  withCredentials: boolean
  database: string
  user: string
}

export interface GrafanaDashboardSummaryItem {
  id: number
  uid: string
  title: string
  url: string
  type: string
  tags: string[]
  isStarred: boolean
  folderUid: string
  folderTitle: string
}

export interface GrafanaDashboardData {
  connected: boolean
  uid: string
  title: string
  url: string
  panelCount: number
  dashboardJson: string
  metaJson: string
}

export interface GrafanaFolderItem {
  id: number
  uid: string
  title: string
  url: string
}

export interface GrafanaAnnotationItem {
  id: number
  alertId: number
  dashboardUid: string
  panelId: number
  userName: string
  newState: string
  prevState: string
  time: number
  timeEnd: number
  text: string
  tagsJson: string
  dataJson: string
}

export interface GrafanaAlertInstanceItem {
  fingerprint: string
  startsAt: string
  endsAt: string
  statusJson: string
  labelsJson: string
  annotationsJson: string
  receiversJson: string
}

export interface GrafanaAlertRuleItem {
  uid: string
  title: string
  folderUid: string
  namespaceUid: string
  dashboardUid: string
  panelId: number
  ruleGroup: string
  condition: string
  dataJson: string
  noDataState: string
  execErrState: string
  duration: string
  intervalSeconds: number
  paused: boolean
  updated: string
  version: number
  labelsJson: string
  annotationsJson: string
  ruleJson: string
}

export interface GrafanaContactPointItem {
  uid: string
  name: string
  type: string
  settingsJson: string
  disableResolveMessage: boolean
}

export interface GrafanaNotificationPolicyData {
  connected: boolean
  receiver: string
  groupByJson: string
  groupWait: string
  groupInterval: string
  repeatInterval: string
  policyJson: string
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

type Component = 'prometheus' | 'alertmanager' | 'loki' | 'grafana'
type HttpMethod = 'GET' | 'POST' | 'DELETE'

interface ComponentOptions {
  baseUrl: string
  token?: string
  username?: string
  password?: string
  tenantId?: string
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

function asNumericValue(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function asBoolean(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true
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

function mapStringItems(data: unknown): string[] {
  return asArray(data).map(value => typeof value === 'string' ? value : String(value ?? ''))
}

function mapLokiQueryData(data: unknown): LokiQueryData {
  const record = asRecord(data)
  const result = asArray(record.result)
  const entryCount = result.reduce((count: number, rawItem) => {
    const item = asRecord(rawItem)
    return count + asArray(item.values).length
  }, 0)
  return {
    connected: true,
    resultType: asString(record, 'resultType'),
    seriesCount: result.length,
    entryCount,
    resultJson: JSON.stringify(result),
  }
}

function mapLokiVolumeData(data: unknown): LokiVolumeData {
  const record = asRecord(data)
  const result = asArray(record.result)
  let totalBytes = 0
  for (const rawItem of result) {
    const item = asRecord(rawItem)
    const values = asArray(item.values)
    const value = asArray(item.value)
    const samples = values.length > 0 ? values : value.length > 0 ? [value] : []
    for (const sample of samples) {
      const tuple = asArray(sample)
      if (tuple.length >= 2) totalBytes += asNumericValue(tuple[tuple.length - 1])
    }
  }
  return {
    connected: true,
    resultType: asString(record, 'resultType'),
    seriesCount: result.length,
    totalBytes,
    resultJson: JSON.stringify(result),
  }
}

function mapLokiPatterns(data: unknown): LokiPatternItem[] {
  return asArray(data).map(rawItem => {
    const record = asRecord(rawItem)
    const samples = asArray(record.samples)
    const totalCount = samples.reduce((sum: number, sample) => {
      const tuple = asArray(sample)
      return sum + (tuple.length >= 2 ? asNumericValue(tuple[tuple.length - 1]) : 0)
    }, 0)
    return {
      pattern: asString(record, 'pattern'),
      sampleCount: samples.length,
      totalCount,
      samplesJson: JSON.stringify(samples),
    }
  })
}

function mapGrafanaDatasource(data: unknown): GrafanaDatasourceItem {
  const record = asRecord(data)
  return {
    id: asNumber(record, 'id'),
    uid: asString(record, 'uid'),
    name: asString(record, 'name'),
    type: asString(record, 'type'),
    url: asString(record, 'url'),
    access: asString(record, 'access'),
    isDefault: asBoolean(record, 'isDefault'),
    basicAuth: asBoolean(record, 'basicAuth'),
    withCredentials: asBoolean(record, 'withCredentials'),
    database: asString(record, 'database'),
    user: asString(record, 'user'),
  }
}

function mapGrafanaDashboardSummary(data: unknown): GrafanaDashboardSummaryItem {
  const record = asRecord(data)
  return {
    id: asNumber(record, 'id'),
    uid: asString(record, 'uid'),
    title: asString(record, 'title'),
    url: asString(record, 'url'),
    type: asString(record, 'type'),
    tags: asArray(record.tags).map(tag => typeof tag === 'string' ? tag : String(tag ?? '')),
    isStarred: asBoolean(record, 'isStarred'),
    folderUid: asString(record, 'folderUid'),
    folderTitle: asString(record, 'folderTitle'),
  }
}

function mapGrafanaFolder(data: unknown): GrafanaFolderItem {
  const record = asRecord(data)
  return {
    id: asNumber(record, 'id'),
    uid: asString(record, 'uid'),
    title: asString(record, 'title'),
    url: asString(record, 'url'),
  }
}

function mapLokiDetectedField(data: unknown): LokiDetectedFieldItem {
  const record = asRecord(data)
  return {
    label: asString(record, 'label'),
    type: asString(record, 'type'),
    cardinality: asNumber(record, 'cardinality'),
    parsersJson: JSON.stringify(asArray(record.parsers)),
    jsonPath: asString(record, 'jsonPath'),
  }
}

function mapGrafanaAnnotation(data: unknown): GrafanaAnnotationItem {
  const record = asRecord(data)
  return {
    id: asNumber(record, 'id'),
    alertId: asNumber(record, 'alertId'),
    dashboardUid: asString(record, 'dashboardUID') || asString(record, 'dashboardUid'),
    panelId: asNumber(record, 'panelId'),
    userName: asString(record, 'userName'),
    newState: asString(record, 'newState'),
    prevState: asString(record, 'prevState'),
    time: asNumber(record, 'time'),
    timeEnd: asNumber(record, 'timeEnd'),
    text: asString(record, 'text'),
    tagsJson: toJson(record.tags),
    dataJson: toJson(record.data),
  }
}

function mapGrafanaAlertInstance(data: unknown): GrafanaAlertInstanceItem {
  const record = asRecord(data)
  return {
    fingerprint: asString(record, 'fingerprint'),
    startsAt: asString(record, 'startsAt'),
    endsAt: asString(record, 'endsAt'),
    statusJson: toJson(record.status),
    labelsJson: toJson(record.labels),
    annotationsJson: toJson(record.annotations),
    receiversJson: toJson(record.receivers),
  }
}

function mapGrafanaAlertRule(data: unknown): GrafanaAlertRuleItem {
  const record = asRecord(data)
  return {
    uid: asString(record, 'uid'),
    title: asString(record, 'title'),
    folderUid: asString(record, 'folderUID') || asString(record, 'folderUid'),
    namespaceUid: asString(record, 'namespaceUID') || asString(record, 'namespaceUid'),
    dashboardUid: asString(record, 'dashboardUID') || asString(record, 'dashboardUid'),
    panelId: asNumber(record, 'panelID') || asNumber(record, 'panelId'),
    ruleGroup: asString(record, 'ruleGroup') || asString(record, 'rule_group'),
    condition: asString(record, 'condition'),
    dataJson: toJson(record.data),
    noDataState: asString(record, 'noDataState') || asString(record, 'no_data_state'),
    execErrState: asString(record, 'execErrState') || asString(record, 'exec_err_state'),
    duration: asString(record, 'for') || asString(record, 'duration') || asString(record, 'forDuration'),
    intervalSeconds: asNumber(record, 'intervalSeconds') || asNumber(record, 'interval_seconds'),
    paused: asBoolean(record, 'paused'),
    updated: asString(record, 'updated'),
    version: asNumber(record, 'version'),
    labelsJson: toJson(record.labels),
    annotationsJson: toJson(record.annotations),
    ruleJson: JSON.stringify(data ?? {}),
  }
}

function mapGrafanaContactPoint(data: unknown): GrafanaContactPointItem {
  const record = asRecord(data)
  return {
    uid: asString(record, 'uid'),
    name: asString(record, 'name'),
    type: asString(record, 'type'),
    settingsJson: toJson(record.settings),
    disableResolveMessage: asBoolean(record, 'disableResolveMessage'),
  }
}

function mapGrafanaNotificationPolicy(data: unknown): GrafanaNotificationPolicyData {
  const record = asRecord(data)
  return {
    connected: true,
    receiver: asString(record, 'receiver'),
    groupByJson: toJson(record.group_by),
    groupWait: asString(record, 'group_wait'),
    groupInterval: asString(record, 'group_interval'),
    repeatInterval: asString(record, 'repeat_interval'),
    policyJson: JSON.stringify(data ?? {}),
  }
}

function countPanels(panels: unknown): number {
  return asArray(panels).reduce((sum: number, rawPanel) => {
    const panel = asRecord(rawPanel)
    return sum + 1 + countPanels(panel.panels)
  }, 0)
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
  private readonly loki: ComponentOptions
  private readonly grafana: ComponentOptions
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
    this.loki = {
      baseUrl: (options.lokiBaseUrl ?? 'http://localhost:3100').replace(/\/+$/, ''),
      token: options.lokiToken,
      username: options.lokiUsername,
      password: options.lokiPassword,
      tenantId: options.lokiTenantId,
    }
    this.grafana = {
      baseUrl: (options.grafanaBaseUrl ?? 'http://localhost:3000').replace(/\/+$/, ''),
      token: options.grafanaToken,
      username: options.grafanaUsername,
      password: options.grafanaPassword,
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

  hasLoki(): boolean {
    return this.loki.baseUrl.length > 0
  }

  hasGrafana(): boolean {
    return this.grafana.baseUrl.length > 0
  }

  private combinedSignal(signal?: AbortSignal): AbortSignal | undefined {
    if (this.timeoutMs <= 0) return signal
    const timeout = AbortSignal.timeout(this.timeoutMs)
    return signal ? AbortSignal.any([signal, timeout]) : timeout
  }

  private headers(component: Component): Record<string, string> {
    const options = component === 'prometheus'
      ? this.prometheus
      : component === 'loki' ? this.loki
        : component === 'grafana' ? this.grafana : this.alertmanager
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
    if (options.tenantId) headers['x-scope-orgid'] = options.tenantId
    return headers
  }

  private async request(
    component: Component,
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const options = component === 'prometheus'
      ? this.prometheus
      : component === 'loki' ? this.loki
        : component === 'grafana' ? this.grafana : this.alertmanager
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
      const payloadRecord = asRecord(payload)
      const message = asString(payloadRecord, 'message') || asString(payloadRecord, 'error') || `HTTP ${response.status}`
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

  private async grafanaRequest(
    method: HttpMethod,
    path: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    return this.request('grafana', method, path, undefined, signal)
  }

  private async lokiRequest(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const payload = await this.request('loki', method, path, body, signal)
    const record = asRecord(payload)
    if (record.status === 'error') {
      const errorType = asString(record, 'errorType')
      const message = asString(record, 'error') || asString(record, 'message') || 'Loki API error'
      throw new MonitoringError(errorType ? `${errorType}: ${message}` : message, 400)
    }
    if (record.status === 'success' && 'data' in record) return record.data
    return payload
  }

  private async lokiTextRequest(path: string, signal?: AbortSignal): Promise<string> {
    const headers = this.headers('loki')
    headers.accept = 'application/yaml, text/yaml, text/plain, application/json, */*;q=0.1'
    const response = await this.fetchImpl(`${this.loki.baseUrl}${path}`, {
      method: 'GET',
      headers,
      signal: this.combinedSignal(signal),
    })
    const raw = await response.text()
    if (!response.ok) {
      let message = `HTTP ${response.status}`
      try {
        const payload = asRecord(JSON.parse(raw))
        message = asString(payload, 'message') || asString(payload, 'error') || message
      } catch {
        // Keep the HTTP fallback when the response body is not JSON.
      }
      throw new MonitoringError(message, response.status)
    }
    return raw
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

  async lokiQuery(
    query: string,
    options: {
      time?: string
      limit?: number
      direction?: string
      signal?: AbortSignal
    } = {},
  ): Promise<LokiQueryData> {
    const params = [`query=${encodeURIComponent(query)}`]
    if (options.time) params.push(`time=${encodeURIComponent(options.time)}`)
    if (options.limit && options.limit > 0) params.push(`limit=${Math.floor(options.limit)}`)
    if (options.direction) params.push(`direction=${encodeURIComponent(options.direction)}`)
    const data = await this.lokiRequest(
      'GET',
      `/loki/api/v1/query?${params.join('&')}`,
      undefined,
      options.signal,
    )
    return mapLokiQueryData(data)
  }

  async lokiQueryRange(
    query: string,
    options: {
      start?: string
      end?: string
      step?: string
      limit?: number
      direction?: string
      interval?: string
      signal?: AbortSignal
    } = {},
  ): Promise<LokiQueryData> {
    const params = [`query=${encodeURIComponent(query)}`]
    if (options.start) params.push(`start=${encodeURIComponent(options.start)}`)
    if (options.end) params.push(`end=${encodeURIComponent(options.end)}`)
    if (options.step) params.push(`step=${encodeURIComponent(options.step)}`)
    if (options.limit && options.limit > 0) params.push(`limit=${Math.floor(options.limit)}`)
    if (options.direction) params.push(`direction=${encodeURIComponent(options.direction)}`)
    if (options.interval) params.push(`interval=${encodeURIComponent(options.interval)}`)
    const data = await this.lokiRequest(
      'GET',
      `/loki/api/v1/query_range?${params.join('&')}`,
      undefined,
      options.signal,
    )
    return mapLokiQueryData(data)
  }

  async lokiListLabels(
    options: {
      query?: string
      start?: string
      end?: string
      signal?: AbortSignal
    } = {},
  ): Promise<LokiLabelData> {
    const params: string[] = []
    if (options.query) params.push(`query=${encodeURIComponent(options.query)}`)
    if (options.start) params.push(`start=${encodeURIComponent(options.start)}`)
    if (options.end) params.push(`end=${encodeURIComponent(options.end)}`)
    const suffix = params.length > 0 ? `?${params.join('&')}` : ''
    const data = await this.lokiRequest('GET', `/loki/api/v1/labels${suffix}`, undefined, options.signal)
    return { connected: true, items: mapStringItems(data) }
  }

  async lokiGetLabelValues(
    labelName: string,
    options: {
      query?: string
      start?: string
      end?: string
      signal?: AbortSignal
    } = {},
  ): Promise<LokiLabelData> {
    const params: string[] = []
    if (options.query) params.push(`query=${encodeURIComponent(options.query)}`)
    if (options.start) params.push(`start=${encodeURIComponent(options.start)}`)
    if (options.end) params.push(`end=${encodeURIComponent(options.end)}`)
    const suffix = params.length > 0 ? `?${params.join('&')}` : ''
    const data = await this.lokiRequest(
      'GET',
      `/loki/api/v1/label/${encodeURIComponent(labelName)}/values${suffix}`,
      undefined,
      options.signal,
    )
    return { connected: true, items: mapStringItems(data) }
  }

  async lokiListSeries(
    matches: string[],
    options: {
      start?: string
      end?: string
      signal?: AbortSignal
    } = {},
  ): Promise<{
    connected: boolean
    items: LokiSeriesItem[]
  }> {
    if (matches.length === 0) return { connected: true, items: [] }
    const params = matches.map(match => `match[]=${encodeURIComponent(match)}`)
    if (options.start) params.push(`start=${encodeURIComponent(options.start)}`)
    if (options.end) params.push(`end=${encodeURIComponent(options.end)}`)
    const data = await this.lokiRequest(
      'GET',
      `/loki/api/v1/series?${params.join('&')}`,
      undefined,
      options.signal,
    )
    const items = asArray(data).map(series => ({ labelsJson: toJson(series) }))
    return { connected: true, items }
  }

  async lokiGetIndexStats(
    query: string,
    options: {
      start?: string
      end?: string
      signal?: AbortSignal
    } = {},
  ): Promise<LokiIndexStats> {
    const params = [`query=${encodeURIComponent(query)}`]
    if (options.start) params.push(`start=${encodeURIComponent(options.start)}`)
    if (options.end) params.push(`end=${encodeURIComponent(options.end)}`)
    const data = asRecord(await this.lokiRequest(
      'GET',
      `/loki/api/v1/index/stats?${params.join('&')}`,
      undefined,
      options.signal,
    ))
    return {
      connected: true,
      streams: asNumber(data, 'streams'),
      chunks: asNumber(data, 'chunks'),
      entries: asNumber(data, 'entries'),
      bytes: asNumber(data, 'bytes'),
      statsJson: JSON.stringify(data ?? {}),
    }
  }

  async lokiGetStatus(options: { signal?: AbortSignal } = {}): Promise<LokiStatusData> {
    const data = asRecord(await this.lokiRequest('GET', '/loki/api/v1/status/buildinfo', undefined, options.signal))
    return {
      connected: true,
      version: asString(data, 'version'),
      revision: asString(data, 'revision'),
      branch: asString(data, 'branch'),
      buildDate: asString(data, 'buildDate'),
      goVersion: asString(data, 'goVersion'),
      statusJson: JSON.stringify(data ?? {}),
    }
  }

  async lokiListRuleGroups(options: { signal?: AbortSignal } = {}): Promise<LokiRuleGroupData> {
    const ruleGroupsYaml = await this.lokiTextRequest('/loki/api/v1/rules', options.signal)
    return { connected: true, ruleGroupsYaml }
  }

  async lokiListRules(
    options: {
      type?: string
      file?: string
      ruleGroup?: string
      ruleName?: string
      signal?: AbortSignal
    } = {},
  ): Promise<{
    connected: boolean
    items: LokiRuleItem[]
  }> {
    const params: string[] = []
    if (options.type) params.push(`type=${encodeURIComponent(options.type)}`)
    if (options.file) params.push(`file=${encodeURIComponent(options.file)}`)
    if (options.ruleGroup) params.push(`rule_group=${encodeURIComponent(options.ruleGroup)}`)
    if (options.ruleName) params.push(`rule_name=${encodeURIComponent(options.ruleName)}`)
    const suffix = params.length > 0 ? `?${params.join('&')}` : ''
    const data = asRecord(await this.lokiRequest(
      'GET',
      `/prometheus/api/v1/rules${suffix}`,
      undefined,
      options.signal,
    ))
    const items: LokiRuleItem[] = []
    for (const rawGroup of asArray(data.groups)) {
      const group = asRecord(rawGroup)
      for (const rawRule of asArray(group.rules)) {
        const rule = asRecord(rawRule)
        items.push({
          group: asString(group, 'name'),
          file: asString(group, 'file'),
          name: asString(rule, 'name'),
          type: asString(rule, 'type'),
          health: asString(rule, 'health'),
          lastError: asString(rule, 'lastError'),
          query: asString(rule, 'query'),
          duration: asString(rule, 'duration'),
          labelsJson: toJson(rule.labels),
          annotationsJson: toJson(rule.annotations),
          activeAlertCount: asArray(rule.alerts).length,
        })
      }
    }
    return { connected: true, items }
  }

  async lokiListAlerts(options: { signal?: AbortSignal } = {}): Promise<{
    connected: boolean
    items: LokiAlertItem[]
  }> {
    const data = asRecord(await this.lokiRequest('GET', '/prometheus/api/v1/alerts', undefined, options.signal))
    const items = asArray(data.alerts).map(rawAlert => {
      const alert = asRecord(rawAlert)
      return {
        state: asString(alert, 'state'),
        value: asString(alert, 'value'),
        activeAt: asString(alert, 'activeAt'),
        labelsJson: toJson(alert.labels),
        annotationsJson: toJson(alert.annotations),
      }
    })
    return { connected: true, items }
  }

  async lokiGetIndexVolume(
    query: string,
    options: {
      start: string
      end: string
      limit?: number
      targetLabels?: string
      aggregateBy?: string
      signal?: AbortSignal
    },
  ): Promise<LokiVolumeData> {
    const params = [
      `query=${encodeURIComponent(query)}`,
      `start=${encodeURIComponent(options.start)}`,
      `end=${encodeURIComponent(options.end)}`,
    ]
    if (options.limit && options.limit > 0) params.push(`limit=${Math.floor(options.limit)}`)
    if (options.targetLabels) params.push(`targetLabels=${encodeURIComponent(options.targetLabels)}`)
    if (options.aggregateBy) params.push(`aggregateBy=${encodeURIComponent(options.aggregateBy)}`)
    const data = await this.lokiRequest(
      'GET',
      `/loki/api/v1/index/volume?${params.join('&')}`,
      undefined,
      options.signal,
    )
    return mapLokiVolumeData(data)
  }

  async lokiGetIndexVolumeRange(
    query: string,
    options: {
      start: string
      end: string
      step?: string
      limit?: number
      targetLabels?: string
      aggregateBy?: string
      signal?: AbortSignal
    },
  ): Promise<LokiVolumeData> {
    const params = [
      `query=${encodeURIComponent(query)}`,
      `start=${encodeURIComponent(options.start)}`,
      `end=${encodeURIComponent(options.end)}`,
    ]
    if (options.step) params.push(`step=${encodeURIComponent(options.step)}`)
    if (options.limit && options.limit > 0) params.push(`limit=${Math.floor(options.limit)}`)
    if (options.targetLabels) params.push(`targetLabels=${encodeURIComponent(options.targetLabels)}`)
    if (options.aggregateBy) params.push(`aggregateBy=${encodeURIComponent(options.aggregateBy)}`)
    const data = await this.lokiRequest(
      'GET',
      `/loki/api/v1/index/volume_range?${params.join('&')}`,
      undefined,
      options.signal,
    )
    return mapLokiVolumeData(data)
  }

  async lokiGetPatterns(
    query: string,
    options: {
      start: string
      end: string
      step?: string
      signal?: AbortSignal
    },
  ): Promise<{
    connected: boolean
    items: LokiPatternItem[]
  }> {
    const params = [
      `query=${encodeURIComponent(query)}`,
      `start=${encodeURIComponent(options.start)}`,
      `end=${encodeURIComponent(options.end)}`,
    ]
    if (options.step) params.push(`step=${encodeURIComponent(options.step)}`)
    const data = await this.lokiRequest(
      'GET',
      `/loki/api/v1/patterns?${params.join('&')}`,
      undefined,
      options.signal,
    )
    return { connected: true, items: mapLokiPatterns(data) }
  }

  async lokiGetDetectedFields(
    query: string,
    options: {
      start?: string
      end?: string
      since?: string
      step?: string
      lineLimit?: number
      limit?: number
      signal?: AbortSignal
    } = {},
  ): Promise<{
    connected: boolean
    items: LokiDetectedFieldItem[]
    limit: number
  }> {
    const params = [`query=${encodeURIComponent(query)}`]
    if (options.start) params.push(`start=${encodeURIComponent(options.start)}`)
    if (options.end) params.push(`end=${encodeURIComponent(options.end)}`)
    if (options.since) params.push(`since=${encodeURIComponent(options.since)}`)
    if (options.step) params.push(`step=${encodeURIComponent(options.step)}`)
    if (options.lineLimit && options.lineLimit > 0) {
      params.push(`line_limit=${Math.floor(options.lineLimit)}`)
    }
    if (options.limit && options.limit > 0) params.push(`limit=${Math.floor(options.limit)}`)
    const data = asRecord(await this.lokiRequest(
      'GET',
      `/loki/api/v1/detected_fields?${params.join('&')}`,
      undefined,
      options.signal,
    ))
    const items = asArray(data.fields).map(mapLokiDetectedField)
    return { connected: true, items, limit: asNumber(data, 'limit') }
  }

  async lokiGetDetectedFieldValues(
    fieldName: string,
    query: string,
    options: {
      start?: string
      end?: string
      since?: string
      step?: string
      lineLimit?: number
      limit?: number
      signal?: AbortSignal
    } = {},
  ): Promise<{
    connected: boolean
    items: string[]
    limit: number
  }> {
    const params = [`query=${encodeURIComponent(query)}`]
    if (options.start) params.push(`start=${encodeURIComponent(options.start)}`)
    if (options.end) params.push(`end=${encodeURIComponent(options.end)}`)
    if (options.since) params.push(`since=${encodeURIComponent(options.since)}`)
    if (options.step) params.push(`step=${encodeURIComponent(options.step)}`)
    if (options.lineLimit && options.lineLimit > 0) {
      params.push(`line_limit=${Math.floor(options.lineLimit)}`)
    }
    if (options.limit && options.limit > 0) params.push(`limit=${Math.floor(options.limit)}`)
    const data = asRecord(await this.lokiRequest(
      'GET',
      `/loki/api/v1/detected_field/${encodeURIComponent(fieldName)}/values?${params.join('&')}`,
      undefined,
      options.signal,
    ))
    return {
      connected: true,
      items: mapStringItems(data.values),
      limit: asNumber(data, 'limit'),
    }
  }

  async grafanaGetHealth(options: { signal?: AbortSignal } = {}): Promise<GrafanaHealthData> {
    const data = asRecord(await this.grafanaRequest('GET', '/api/health', options.signal))
    return {
      connected: true,
      database: asString(data, 'database'),
      version: asString(data, 'version'),
      commit: asString(data, 'commit'),
      statusJson: JSON.stringify(data ?? {}),
    }
  }

  async grafanaListDatasources(options: { signal?: AbortSignal } = {}): Promise<{
    connected: boolean
    items: GrafanaDatasourceItem[]
  }> {
    const data = await this.grafanaRequest('GET', '/api/datasources', options.signal)
    const items = asArray(data).map(mapGrafanaDatasource)
    return { connected: true, items }
  }

  async grafanaGetDatasource(
    uid: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<{
    connected: boolean
    item: GrafanaDatasourceItem
  }> {
    const data = await this.grafanaRequest(
      'GET',
      `/api/datasources/uid/${encodeURIComponent(uid)}`,
      options.signal,
    )
    return { connected: true, item: mapGrafanaDatasource(data) }
  }

  async grafanaSearchDashboards(
    options: {
      query?: string
      tag?: string
      starred?: boolean
      limit?: number
      page?: number
      signal?: AbortSignal
    } = {},
  ): Promise<{
    connected: boolean
    items: GrafanaDashboardSummaryItem[]
  }> {
    const params = ['type=dash-db']
    if (options.query) params.push(`query=${encodeURIComponent(options.query)}`)
    if (options.tag) params.push(`tag=${encodeURIComponent(options.tag)}`)
    if (options.starred !== undefined) params.push(`starred=${options.starred ? 'true' : 'false'}`)
    if (options.limit && options.limit > 0) params.push(`limit=${Math.floor(options.limit)}`)
    if (options.page && options.page > 0) params.push(`page=${Math.floor(options.page)}`)
    const data = await this.grafanaRequest(
      'GET',
      `/api/search?${params.join('&')}`,
      options.signal,
    )
    const items = asArray(data).map(mapGrafanaDashboardSummary)
    return { connected: true, items }
  }

  async grafanaGetDashboard(
    uid: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<GrafanaDashboardData> {
    const data = asRecord(await this.grafanaRequest(
      'GET',
      `/api/dashboards/uid/${encodeURIComponent(uid)}`,
      options.signal,
    ))
    const dashboard = asRecord(data.dashboard)
    const meta = asRecord(data.meta)
    const panels = asArray(dashboard.panels)
    return {
      connected: true,
      uid: asString(dashboard, 'uid'),
      title: asString(dashboard, 'title'),
      url: asString(dashboard, 'url') || asString(meta, 'url') || `/d/${encodeURIComponent(uid)}`,
      panelCount: countPanels(panels),
      dashboardJson: JSON.stringify(data.dashboard ?? {}),
      metaJson: JSON.stringify(data.meta ?? {}),
    }
  }

  async grafanaListFolders(options: { signal?: AbortSignal } = {}): Promise<{
    connected: boolean
    items: GrafanaFolderItem[]
  }> {
    const data = await this.grafanaRequest('GET', '/api/folders', options.signal)
    const items = asArray(data).map(mapGrafanaFolder)
    return { connected: true, items }
  }

  async grafanaListAnnotations(
    options: {
      from?: string
      to?: string
      limit?: number
      dashboardUid?: string
      panelId?: number
      type?: string
      tags?: string[]
      signal?: AbortSignal
    } = {},
  ): Promise<{
    connected: boolean
    items: GrafanaAnnotationItem[]
  }> {
    const params: string[] = []
    if (options.from) params.push(`from=${encodeURIComponent(options.from)}`)
    if (options.to) params.push(`to=${encodeURIComponent(options.to)}`)
    if (options.limit && options.limit > 0) params.push(`limit=${Math.floor(options.limit)}`)
    if (options.dashboardUid) params.push(`dashboardUID=${encodeURIComponent(options.dashboardUid)}`)
    if (options.panelId !== undefined) params.push(`panelId=${Math.floor(options.panelId)}`)
    if (options.type) params.push(`type=${encodeURIComponent(options.type)}`)
    for (const tag of options.tags ?? []) {
      if (tag) params.push(`tags=${encodeURIComponent(tag)}`)
    }
    const suffix = params.length > 0 ? `?${params.join('&')}` : ''
    const data = await this.grafanaRequest('GET', `/api/annotations${suffix}`, options.signal)
    const items = asArray(data).map(mapGrafanaAnnotation)
    return { connected: true, items }
  }

  async grafanaListAlertInstances(
    options: {
      active?: boolean
      silenced?: boolean
      inhibited?: boolean
      receiver?: string
      signal?: AbortSignal
    } = {},
  ): Promise<{
    connected: boolean
    items: GrafanaAlertInstanceItem[]
  }> {
    const params: string[] = []
    if (options.active === false) params.push('active=false')
    if (options.silenced === false) params.push('silenced=false')
    if (options.inhibited === false) params.push('inhibited=false')
    if (options.receiver) params.push(`receiver=${encodeURIComponent(options.receiver)}`)
    const suffix = params.length > 0 ? `?${params.join('&')}` : ''
    const data = await this.grafanaRequest(
      'GET',
      `/api/alertmanager/grafana/api/v2/alerts${suffix}`,
      options.signal,
    )
    const items = asArray(data).map(mapGrafanaAlertInstance)
    return { connected: true, items }
  }

  async grafanaListAlertRules(options: { signal?: AbortSignal } = {}): Promise<{
    connected: boolean
    items: GrafanaAlertRuleItem[]
  }> {
    const data = await this.grafanaRequest(
      'GET',
      '/api/v1/provisioning/alert-rules',
      options.signal,
    )
    const items = asArray(data).map(mapGrafanaAlertRule)
    return { connected: true, items }
  }

  async grafanaGetAlertRule(
    uid: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<{
    connected: boolean
    item: GrafanaAlertRuleItem
  }> {
    const data = await this.grafanaRequest(
      'GET',
      `/api/v1/provisioning/alert-rules/${encodeURIComponent(uid)}`,
      options.signal,
    )
    return { connected: true, item: mapGrafanaAlertRule(data) }
  }

  async grafanaListContactPoints(options: { signal?: AbortSignal } = {}): Promise<{
    connected: boolean
    items: GrafanaContactPointItem[]
  }> {
    const data = await this.grafanaRequest(
      'GET',
      '/api/v1/provisioning/contact-points',
      options.signal,
    )
    const items = asArray(data).map(mapGrafanaContactPoint)
    return { connected: true, items }
  }

  async grafanaGetNotificationPolicy(options: { signal?: AbortSignal } = {}): Promise<GrafanaNotificationPolicyData> {
    const data = await this.grafanaRequest(
      'GET',
      '/api/v1/provisioning/policies',
      options.signal,
    )
    return mapGrafanaNotificationPolicy(data)
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
