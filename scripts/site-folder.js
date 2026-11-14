/**
 * Check a HAXcms site folder against schema/haxcms-site-contract.json.
 *
 * The contract lists every path a site may hold with a status (required,
 * optional, retired) and an owner. This module reads it, classifies the files
 * found in a folder and reports which conformance level the folder reaches:
 *
 *   content   valid site.json and a file at every item's location
 *   runnable  content plus the loader files
 *   managed   runnable plus every file a HAXcms backend writes and rebuilds
 *
 * Used by scripts/validate.js (`jos-validate --site <dir>`), which supplies
 * the site.json validator. Nothing here follows a symbolic link or reads
 * outside the folder it is given.
 */
const fs = require('fs')
const path = require('path')

const CONTRACT_FILE = path.join(__dirname, '..', 'schema', 'haxcms-site-contract.json')

function loadContract (file = CONTRACT_FILE) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const hasWildcard = (pattern) => pattern.includes('*')

/** `*` stays inside one path segment, `**` crosses segments. */
function patternToRegExp (pattern) {
  const source = pattern
    .split('**')
    .map((part) => part
      .split('*')
      .map((literal) => literal.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^/]*'))
    .join('.*')
  return new RegExp(`^${source}$`)
}

/**
 * Prepare a contract for matching. Returns { classify, literals, levels }.
 * A path without a wildcard is matched first; otherwise the first matching
 * entry in list order wins.
 */
function compileContract (contract) {
  const literals = new Map()
  const patterns = []
  for (const entry of contract.entries) {
    if (hasWildcard(entry.path)) patterns.push({ entry, test: patternToRegExp(entry.path) })
    else if (!literals.has(entry.path)) literals.set(entry.path, entry)
  }
  const classify = (relativePath) => {
    if (literals.has(relativePath)) return literals.get(relativePath)
    const hit = patterns.find((p) => p.test.test(relativePath))
    return hit ? hit.entry : null
  }
  return { classify, literals, levels: contract.levels.map((level) => level.id) }
}

/**
 * Every file and symbolic link under root, as `/`-separated paths relative
 * to it. Links are listed, never followed. Names in `ignore` are skipped at
 * the top level only.
 */
function listFolder (root, ignore = []) {
  const found = []
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (prefix === '' && ignore.includes(entry.name)) continue
      const relativePath = prefix + entry.name
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${relativePath}/`)
      else found.push(relativePath)
    }
  }
  walk(root, '')
  return found.sort()
}

/** A location is usable only as a plain relative path inside the site. */
function isSafeLocation (location) {
  if (typeof location !== 'string' || location === '') return false
  if (location.includes('\0') || location.includes('\\')) return false
  if (location.startsWith('/') || /^[A-Za-z]:/.test(location)) return false
  return !location.split('/').some((segment) => segment === '..' || segment === '.' || segment === '')
}

/**
 * Check one folder.
 *
 * options:
 *   level       level the folder must reach (default: the lowest)
 *   exhaustive  a file no contract entry covers is an error
 *   isNew       a retired path is an error (for a site that was just made)
 *   contract    a parsed contract (default: the one in ../schema)
 *   validateManifest(doc) -> { errors, warnings } for site.json
 *
 * Returns { level, reached, valid, errors, warnings, unclassified, retired, counts }.
 * `reached` is the highest level the folder satisfies, or null.
 */
function checkSiteFolder (root, options = {}) {
  const contract = options.contract || loadContract()
  const { classify, levels } = compileContract(contract)
  const target = options.level || levels[0]
  if (!levels.includes(target)) {
    throw new Error(`unknown level "${target}" (expected ${levels.join(', ')})`)
  }
  const errors = []
  const warnings = []
  // errors that decide a level carry that level; the rest only affect `valid`
  const fail = (level, at, message) => errors.push({ level, path: at, message })

  let stat = null
  try {
    stat = fs.statSync(root)
  } catch (e) {
    stat = null
  }
  if (!stat || !stat.isDirectory()) {
    fail(levels[0], '/', 'not a folder')
    return { level: target, reached: null, valid: false, errors, warnings, unclassified: [], retired: [], counts: {} }
  }

  const files = listFolder(root, contract.ignore || [])
  const present = new Set(files)

  // site.json: parse, schema, then a file for every item
  let manifest = null
  if (present.has('site.json')) {
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(root, 'site.json'), 'utf8'))
    } catch (e) {
      fail(levels[0], 'site.json', `cannot read JSON: ${e.message}`)
    }
  }
  if (manifest && typeof options.validateManifest === 'function') {
    const result = options.validateManifest(manifest)
    for (const e of result.errors) fail(levels[0], `site.json#${e.path}`, e.message)
    for (const w of result.warnings) warnings.push({ path: `site.json#${w.path}`, message: w.message })
  }
  const items = manifest && Array.isArray(manifest.items) ? manifest.items : []
  items.forEach((item, i) => {
    // an item without a location is already a site.json schema error
    if (!item || typeof item.id !== 'string' || typeof item.location !== 'string') return
    const location = item.location
    if (!isSafeLocation(location)) {
      fail(levels[0], `site.json#/items/${i}/location`, `location "${location}" must be a relative path inside the site`)
    } else if (!present.has(location)) {
      fail(levels[0], location, `page file for item "${item.id}" is missing`)
    }
  })

  // required paths, each at the level that first asks for it
  for (const entry of contract.entries) {
    if (entry.status !== 'required' || hasWildcard(entry.path)) continue
    if (!present.has(entry.path)) fail(entry.level, entry.path, `required at the ${entry.level} level (${entry.owner})`)
  }

  // classify what is there
  const unclassified = []
  const retired = []
  const counts = {}
  for (const file of files) {
    const entry = classify(file)
    if (!entry) {
      unclassified.push(file)
      continue
    }
    counts[entry.owner] = (counts[entry.owner] || 0) + 1
    if (entry.status === 'retired') retired.push({ path: file, replacedBy: entry.replacedBy || null })
  }
  for (const r of retired) {
    const message = `retired: no longer written for new sites${r.replacedBy ? ` (replaced by ${r.replacedBy})` : ''}`
    if (options.isNew) fail(null, r.path, message)
    else warnings.push({ path: r.path, message })
  }
  if (options.exhaustive) {
    for (const file of unclassified) fail(null, file, 'not covered by any contract entry')
  }

  // highest level with nothing missing at or below it
  let reached = null
  for (const level of levels) {
    const upTo = levels.slice(0, levels.indexOf(level) + 1)
    if (errors.some((e) => e.level && upTo.includes(e.level))) break
    reached = level
  }
  const wanted = levels.slice(0, levels.indexOf(target) + 1)
  const counted = errors.filter((e) => !e.level || wanted.includes(e.level))
  return {
    level: target,
    reached,
    valid: counted.length === 0,
    errors: counted,
    warnings,
    unclassified,
    retired: retired.map((r) => r.path),
    counts
  }
}

/**
 * Compare a backend's site boilerplate folder with the contract's
 * `boilerplate: true` entries. Returns { missing, extra, retired }:
 *   missing  contract says the boilerplate ships it, the folder does not
 *   extra    the folder ships it, no boilerplate entry covers it
 *   retired  the folder still ships a retired path
 */
function compareBoilerplate (root, contract = loadContract()) {
  const { classify } = compileContract(contract)
  const files = listFolder(root, contract.ignore || [])
  const present = new Set(files)
  const missing = contract.entries
    .filter((entry) => entry.boilerplate === true && !hasWildcard(entry.path) && !present.has(entry.path))
    .map((entry) => entry.path)
  const extra = []
  const retired = []
  for (const file of files) {
    const entry = classify(file)
    if (entry && entry.status === 'retired') retired.push(file)
    else if (!entry || entry.boilerplate !== true) extra.push(file)
  }
  return { missing, extra, retired }
}

module.exports = {
  CONTRACT_FILE,
  loadContract,
  patternToRegExp,
  compileContract,
  listFolder,
  isSafeLocation,
  checkSiteFolder,
  compareBoilerplate
}
