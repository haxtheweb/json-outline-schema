#!/usr/bin/env node
/**
 * Validate JSON Outline Schema documents (core outlines, HAXcms site.json,
 * and HAXcms skeletons) against the schemas in ../schema plus the
 * referential rules JSON Schema cannot express.
 *
 * Usage:
 *   node scripts/validate.js [--type core|site|skeleton] [--json] [--strict] <file> [file...]
 *
 * --type    force a schema; by default it is detected per file:
 *           has `build.items`          -> skeleton
 *           has `metadata.site` object -> site (HAXcms site.json)
 *           otherwise                  -> core
 * --json    print a machine-readable report (one object per file)
 * --strict  treat warnings as errors
 *
 * Exit code: 0 when every file is valid, 1 otherwise.
 */
const fs = require('fs')
const path = require('path')
const Ajv2020 = require('ajv/dist/2020')

const SCHEMA_DIR = path.join(__dirname, '..', 'schema')
const SCHEMAS = {
  core: 'json-outline-schema.schema.json',
  site: 'haxcms-site.schema.json',
  skeleton: 'skeleton.schema.json'
}

function buildValidators () {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  const ids = {}
  for (const [key, file] of Object.entries(SCHEMAS)) {
    const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8'))
    ajv.addSchema(schema)
    ids[key] = schema.$id
  }
  const validators = {}
  for (const key of Object.keys(SCHEMAS)) {
    validators[key] = ajv.getSchema(ids[key])
  }
  return validators
}

function detectType (doc) {
  if (doc && doc.build && Array.isArray(doc.build.items)) return 'skeleton'
  if (doc && doc.metadata && typeof doc.metadata.site === 'object') return 'site'
  return 'core'
}

const isRoot = (parent) => parent === null || parent === '' || typeof parent === 'undefined'

/**
 * Checks JSON Schema cannot express. Returns { errors, warnings } arrays of
 * { path, message } objects.
 */
function referentialChecks (items, type) {
  const errors = []
  const warnings = []
  if (!Array.isArray(items)) return { errors, warnings }
  const base = type === 'skeleton' ? '/build/items' : '/items'
  const byId = new Map()
  items.forEach((item, i) => {
    if (!item || typeof item.id !== 'string') return
    if (byId.has(item.id)) {
      errors.push({ path: `${base}/${i}/id`, message: `duplicate id "${item.id}" (also at index ${byId.get(item.id).index})` })
    } else {
      byId.set(item.id, { item, index: i })
    }
  })
  // parent references + cycles + depth
  const depthCache = new Map()
  const depthOf = (id, seen = new Set()) => {
    if (depthCache.has(id)) return depthCache.get(id)
    const entry = byId.get(id)
    if (!entry) return 0
    if (seen.has(id)) return -1
    seen.add(id)
    const parent = entry.item.parent
    if (isRoot(parent) || !byId.has(parent)) {
      depthCache.set(id, 0)
      return 0
    }
    const d = depthOf(parent, seen)
    const result = d < 0 ? -1 : d + 1
    depthCache.set(id, result)
    return result
  }
  items.forEach((item, i) => {
    if (!item || typeof item.id !== 'string') return
    if (!isRoot(item.parent)) {
      if (item.parent === item.id) {
        errors.push({ path: `${base}/${i}/parent`, message: 'item is its own parent' })
      } else if (!byId.has(item.parent)) {
        errors.push({ path: `${base}/${i}/parent`, message: `parent "${item.parent}" does not match any item id` })
      }
    } else if (item.parent === '') {
      warnings.push({ path: `${base}/${i}/parent`, message: 'top-level parent should be null, not ""' })
    }
    // duplicates were already reported; only walk the first occurrence
    if (byId.get(item.id).index !== i) return
    const depth = depthOf(item.id)
    if (depth < 0) {
      errors.push({ path: `${base}/${i}/parent`, message: `parent chain of "${item.id}" contains a cycle` })
    } else if (typeof item.indent !== 'undefined' && Number(item.indent) !== depth) {
      warnings.push({ path: `${base}/${i}/indent`, message: `indent ${JSON.stringify(item.indent)} does not match tree depth ${depth}; fine if intentional (presentation differs from hierarchy), otherwise set indent to ${depth}` })
    }
    if (typeof item.indent === 'string' || typeof item.order === 'string') {
      warnings.push({ path: `${base}/${i}`, message: 'indent/order should be integers, not strings' })
    }
  })
  // unique slugs
  const slugs = new Map()
  items.forEach((item, i) => {
    if (!item || typeof item.slug !== 'string') return
    if (slugs.has(item.slug)) {
      errors.push({ path: `${base}/${i}/slug`, message: `duplicate slug "${item.slug}" (also at index ${slugs.get(item.slug)})` })
    } else {
      slugs.set(item.slug, i)
    }
  })
  // sibling order sanity
  const siblings = new Map()
  items.forEach((item, i) => {
    if (!item) return
    const key = isRoot(item.parent) ? null : item.parent
    if (!siblings.has(key)) siblings.set(key, [])
    siblings.get(key).push({ order: Number(item.order), i })
  })
  for (const [parent, group] of siblings) {
    const seen = new Map()
    for (const { order, i } of group) {
      if (seen.has(order)) {
        warnings.push({ path: `${base}/${i}/order`, message: `order ${order} repeats a sibling (index ${seen.get(order)}) under parent ${JSON.stringify(parent)}; sort becomes ambiguous` })
      } else {
        seen.set(order, i)
      }
    }
  }
  // canonical value types in item metadata (legacy forms are readable, not writable)
  if (type === 'site' || type === 'skeleton') {
    const flags = ['published', 'hideInMenu', 'locked']
    items.forEach((item, i) => {
      const m = item && item.metadata
      if (!m || typeof m !== 'object') return
      for (const k of flags) {
        if (typeof m[k] !== 'undefined' && m[k] !== null && typeof m[k] !== 'boolean') {
          warnings.push({ path: `${base}/${i}/metadata/${k}`, message: `${JSON.stringify(m[k])} should be a boolean (true/false)` })
        }
      }
      for (const k of ['created', 'updated']) {
        if (typeof m[k] === 'string') warnings.push({ path: `${base}/${i}/metadata/${k}`, message: 'timestamp should be an integer, not a string' })
      }
      if (typeof m.tags === 'string') {
        warnings.push({ path: `${base}/${i}/metadata/tags`, message: 'tags should be an array of strings, not a comma-separated string' })
      }
      if (typeof m.relatedItems !== 'undefined') {
        const related = typeof m.relatedItems === 'string' ? [m.relatedItems] : Array.isArray(m.relatedItems) ? m.relatedItems : []
        if (typeof m.relatedItems === 'string') warnings.push({ path: `${base}/${i}/metadata/relatedItems`, message: 'relatedItems should be an array of item ids, not a string' })
        related.forEach((id) => {
          if (typeof id === 'string' && id !== '' && !byId.has(id)) warnings.push({ path: `${base}/${i}/metadata/relatedItems`, message: `related item "${id}" does not match any item id` })
          if (id === item.id) warnings.push({ path: `${base}/${i}/metadata/relatedItems`, message: 'item lists itself as related' })
        })
      }
    })
  }
  // HAXcms location convention
  if (type === 'site') {
    items.forEach((item, i) => {
      if (item && typeof item.location === 'string' && item.location !== `pages/${item.id}/index.html`) {
        warnings.push({ path: `${base}/${i}/location`, message: `location "${item.location}" differs from the HAXcms convention "pages/${item.id}/index.html"` })
      }
    })
  }
  return { errors, warnings }
}

/** Document-level canonical-form checks for HAXcms site.json. */
function siteChecks (doc) {
  const warnings = []
  const site = doc && doc.metadata && doc.metadata.site
  if (site && typeof site.tags === 'string') warnings.push({ path: '/metadata/site/tags', message: 'tags should be an array of strings, not a comma-separated string' })
  for (const k of ['created', 'updated']) {
    if (site && typeof site[k] === 'string') warnings.push({ path: `/metadata/site/${k}`, message: 'timestamp should be an integer, not a string' })
  }
  return warnings
}

function validateDoc (doc, type, validators) {
  const validate = validators[type]
  const ok = validate(doc)
  const errors = ok
    ? []
    : validate.errors.map((e) => ({
      path: e.instancePath || '/',
      message: `${e.message}${e.params && e.params.unevaluatedProperty ? ` ("${e.params.unevaluatedProperty}" - HAXcms drops unknown item keys; move it into metadata)` : ''}${e.params && e.params.allowedValues ? `: ${e.params.allowedValues.join(', ')}` : ''}`
    }))
  const items = type === 'skeleton' ? doc && doc.build && doc.build.items : doc && doc.items
  const ref = referentialChecks(items, type)
  const warnings = type === 'site' ? siteChecks(doc).concat(ref.warnings) : ref.warnings
  return { errors: errors.concat(ref.errors), warnings }
}

function main (argv) {
  const args = argv.slice(2)
  let forced = null
  let asJson = false
  let strict = false
  const files = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--type') forced = args[++i]
    else if (a === '--json') asJson = true
    else if (a === '--strict') strict = true
    else if (a === '-h' || a === '--help') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0])
      return 0
    } else files.push(a)
  }
  if (forced && !SCHEMAS[forced]) {
    console.error(`unknown --type "${forced}" (expected ${Object.keys(SCHEMAS).join(', ')})`)
    return 2
  }
  if (!files.length) {
    console.error('usage: validate.js [--type core|site|skeleton] [--json] [--strict] <file> [file...]')
    return 2
  }
  const validators = buildValidators()
  const reports = []
  for (const file of files) {
    let doc
    try {
      doc = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (e) {
      reports.push({ file, type: null, valid: false, errors: [{ path: '/', message: `cannot read JSON: ${e.message}` }], warnings: [] })
      continue
    }
    const type = forced || detectType(doc)
    const { errors, warnings } = validateDoc(doc, type, validators)
    const valid = errors.length === 0 && (!strict || warnings.length === 0)
    reports.push({ file, type, valid, errors, warnings })
  }
  if (asJson) {
    console.log(JSON.stringify(reports, null, 2))
  } else {
    for (const r of reports) {
      console.log(`${r.valid ? 'PASS' : 'FAIL'} ${r.file}${r.type ? ` (${r.type})` : ''}`)
      for (const e of r.errors) console.log(`  error   ${e.path}: ${e.message}`)
      for (const w of r.warnings) console.log(`  warning ${w.path}: ${w.message}`)
    }
  }
  return reports.every((r) => r.valid) ? 0 : 1
}

module.exports = { buildValidators, detectType, referentialChecks, validateDoc }

if (require.main === module) {
  process.exitCode = main(process.argv)
}
