/** Mod surface code runs only in a script-only opaque-origin iframe built from this document: no network, no frames, no storage. */
export const PLUGIN_CLIENT_FRAME_NAME_PREFIX = 'orca-plugin-client:'

export const PLUGIN_CLIENT_FRAME_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' blob:",
  "connect-src 'none'",
  "img-src 'none'",
  "style-src 'none'",
  "font-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "media-src 'none'",
  "form-action 'none'",
  "base-uri 'none'"
].join('; ')

/** One call's budget in the terminal's engine; the frame faults a call over it, the host kills a frame that stops answering. */
export const PLUGIN_CLIENT_CALL_BUDGET_MS = 1000
export const PLUGIN_CLIENT_HEARTBEAT_MS = 500

// Plain ES2020 so it needs nothing the mod's code could replace before it runs.
function bootstrapScript(channel: string): string {
  const constants = JSON.stringify({
    channel,
    budget: PLUGIN_CLIENT_CALL_BUDGET_MS,
    beat: PLUGIN_CLIENT_HEARTBEAT_MS
  })
  return `(function () {
'use strict'
var C = ${constants}
var host = window.parent
var MAX_LOOP = 3
var FRAME_MS = 16
var engine = null
var urls = {}
var loaded = {}
var instances = new Map()
var chains = new Map()
var timers = new Map()
var timerSeq = 0
function send(message) {
  message.channel = C.channel
  try { host.postMessage(message, '*') } catch (_) {}
}
function reasonOf(error) {
  try {
    var message = error && typeof error === 'object' ? error.message : error
    return String(message === undefined ? '' : message).replace(/[\\u0000-\\u001f\\u2028\\u2029]+/g, ' ').slice(0, 200)
  } catch (_) { return '' }
}
function fault(id, phase, error) { send({ type: 'fault', id: id, phase: phase, reason: reasonOf(error) }) }
function clearTimers(id) {
  timers.forEach(function (entry, timer) {
    if (entry.id === id) { clearInterval(entry.handle); timers.delete(timer) }
  })
}
function remove(id) {
  var instance = instances.get(id)
  clearTimers(id)
  if (instance && instance.postTimer) clearTimeout(instance.postTimer)
  instances.delete(id)
  chains.delete(id)
  if (engine) { try { engine.unmount(id) } catch (_) {} }
}
function drop(id, phase, error) {
  remove(id)
  fault(id, phase, error)
  send({ type: 'gone', id: id })
}
function run(id, kind, payload) {
  var started = performance.now()
  engine.stage(id, kind, payload)
  var out = globalThis.__surface__.run()
  var took = performance.now() - started
  if (took > C.budget) throw new Error('a call took ' + Math.round(took) + ' ms, over the ' + C.budget + ' ms budget')
  return out
}
function schedule(id) {
  var instance = instances.get(id)
  if (!instance) return
  if (instance.rendering) instance.looped = true
  if (instance.queued) return
  instance.queued = true
  setTimeout(function () { render(id) }, FRAME_MS)
}
// The runtime keeps every closure it exported until told to drop it; keep the last two trees' handles live.
function retire(id, instance, text) {
  var handles = []
  var pattern = /"held":(\\d+)/g
  var match
  while ((match = pattern.exec(text))) handles.push(Number(match[1]))
  var old = instance.older
  instance.older = instance.newer
  instance.newer = handles
  if (old.length) engine.dropHeld(id, old)
}
function render(id) {
  var instance = instances.get(id)
  if (!instance) return
  instance.queued = false
  instance.rendering = true
  instance.looped = false
  var text
  try { text = run(id, 'render') } catch (error) { return drop(id, 'render', error) }
  instance.rendering = false
  instance.loop = instance.looped ? instance.loop + 1 : 0
  if (instance.loop >= MAX_LOOP) return drop(id, 'run', 'a render loop: setState on every render')
  if (typeof text !== 'string') return drop(id, 'render', 'the module drew no tree')
  retire(id, instance, text)
  if (text === instance.last) return
  instance.last = text
  send({ type: 'tree', id: id, text: text, key: engine.hasListener(id, 'key'), pointer: engine.hasListener(id, 'pointer') })
}
function input(id, kind, payload) {
  var instance = instances.get(id)
  if (!instance) return
  instance.loop = 0
  try { run(id, kind, payload) } catch (error) { fault(id, 'run', error) }
}
var api = {
  schedule: schedule,
  startTimer: function (id, ms) {
    var timer = ++timerSeq
    var handle = setInterval(function () { input(id, 'tick', timer) }, ms > FRAME_MS ? ms : FRAME_MS)
    timers.set(timer, { id: id, handle: handle })
    return timer
  },
  stopTimer: function (id, timer) {
    var entry = timers.get(timer)
    if (entry) { clearInterval(entry.handle); timers.delete(timer) }
  },
  // One post per frame at most: a later one replaces an undelivered one.
  post: function (id, text) {
    var instance = instances.get(id)
    if (!instance) return
    instance.postText = text
    if (instance.postTimer) return
    instance.postTimer = setTimeout(function () {
      instance.postTimer = 0
      send({ type: 'post', id: id, text: instance.postText })
    }, FRAME_MS)
  },
  fault: function (id, reason) { fault(id, 'run', reason) }
}
function load(entry) {
  if (!loaded[entry]) {
    loaded[entry] = import(entry).catch(function (error) { delete loaded[entry]; throw error })
  }
  return loaded[entry]
}
function boot(message) {
  var map = {}
  message.files.forEach(function (file) {
    urls[file.key] = URL.createObjectURL(new Blob([file.source], { type: 'text/javascript' }))
    map[file.key] = urls[file.key]
  })
  var table = document.createElement('script')
  table.type = 'importmap'
  table.textContent = JSON.stringify({ imports: map })
  document.head.appendChild(table)
  import(urls[message.runtime]).then(function (runtime) {
    globalThis.h = runtime.h
    globalThis.Fragment = runtime.Fragment
    engine = runtime.install(api, message.limits)
    send({ type: 'booted' })
  }).catch(function (error) { send({ type: 'boot-failed', reason: reasonOf(error) }) })
}
function mount(message) {
  var id = message.id
  return load(message.entry).then(function (module) {
    remove(id)
    engine.mount(id, module[message.component], message.props)
    engine.resize(id, message.columns, message.rows)
    instances.set(id, { queued: false, rendering: false, looped: false, loop: 0, last: '', newer: [], older: [], postText: '', postTimer: 0 })
    schedule(id)
  }).catch(function (error) {
    remove(id)
    fault(id, 'load', error)
    send({ type: 'gone', id: id })
  })
}
function enqueue(id, step) {
  var next = (chains.get(id) || Promise.resolve()).then(step).catch(function () {})
  chains.set(id, next)
}
window.addEventListener('message', function (event) {
  var data = event.data
  if (event.source !== host || !data || data.channel !== C.channel) return
  var id = data.id
  switch (data.type) {
    case 'boot': return boot(data)
    case 'mount': return enqueue(id, function () { return mount(data) })
    case 'props': return enqueue(id, function () {
      if (!instances.has(id)) return
      engine.setProps(id, data.props)
      instances.get(id).loop = 0
      schedule(id)
    })
    case 'resize': return enqueue(id, function () {
      if (!instances.has(id)) return
      engine.resize(id, data.columns, data.rows)
      instances.get(id).loop = 0
      schedule(id)
    })
    case 'key': return enqueue(id, function () { input(id, 'key', data.event) })
    case 'pointer': return enqueue(id, function () { input(id, 'pointer', data.event) })
    case 'held': return enqueue(id, function () { input(id, 'held', { handle: data.handle, event: data.event }) })
    case 'unmount': return enqueue(id, function () { remove(id) })
  }
})
setInterval(function () { send({ type: 'alive' }) }, C.beat)
send({ type: 'ready' })
})()`
}

/** The frame's whole document; the mod's own code arrives later, as blob modules the CSP admits. */
export function buildPluginClientFrameDocument(channel: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${PLUGIN_CLIENT_FRAME_CSP}">
<script>${bootstrapScript(channel)}</script>
</head>
<body></body>
</html>`
}
