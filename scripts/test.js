#!/usr/bin/env node
/**
 * Self-test: every valid example must pass and every file in
 * examples/invalid must fail with the expected messages.
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const {
  buildValidators,
  detectType,
  validateDoc,
  validateContract,
  validateSiteFolder,
  loadContract,
  compileContract,
  compareBoilerplate
} = require('./validate.js')

const root = path.join(__dirname, '..')
const validators = buildValidators()
let failures = 0

const check = (file, expectValid, expectMessages = [], expectWarnings = []) => {
  const doc = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
  const { errors, warnings } = validateDoc(doc, detectType(doc), validators)
  const text = errors.map((e) => e.message).join('\n')
  const warnText = warnings.map((w) => w.message).join('\n')
  const okValid = expectValid ? errors.length === 0 : errors.length > 0
  const missing = expectMessages.filter((m) => !text.includes(m))
    .concat(expectWarnings.filter((m) => !warnText.includes(m)).map((m) => `warning: ${m}`))
  if (!okValid || missing.length) {
    failures++
    console.log(`FAIL ${file}`)
    if (!okValid) console.log(`  expected ${expectValid ? 'valid' : 'invalid'}; errors:\n    ${text.split('\n').join('\n    ')}`)
    for (const m of missing) console.log(`  missing expected error containing "${m}"`)
  } else {
    console.log(`ok   ${file}`)
  }
}

check('example.json', true)
check('examples/minimal.json', true)
check('examples/skeleton.json', true)
check('examples/legacy-values.json', true, [], [
  'top-level parent should be null',
  '"1" should be a boolean',
  '"" should be a boolean',
  '0 should be a boolean',
  'timestamp should be an integer',
  'tags should be an array',
  'relatedItems should be an array',
  'indent/order should be integers',
  'build should be an object'
])
check('examples/invalid/missing-parent.json', false, ['does not match any item id'])
check('examples/invalid/cycle-and-duplicates.json', false, ['duplicate id', 'duplicate slug', 'cycle'])
check('examples/invalid/haxcms-unknown-item-key.json', false, ['"content"', 'novice, expert'])
check('examples/invalid/skeleton-bad-plugin-id.json', false, ['must match pattern'])
check('examples/invalid/haxcms-bad-plugin-values.json', false, ['must match pattern', 'must be object'])

if (fs.readdirSync(path.join(root, 'examples', 'invalid')).length !== 5) {
  failures++
  console.log('FAIL examples/invalid has files without an expectation in scripts/test.js')
}

// ---- site folder contract ----
const expect = (name, condition, detail = '') => {
  if (condition) {
    console.log(`ok   ${name}`)
  } else {
    failures++
    console.log(`FAIL ${name}${detail ? `\n  ${detail}` : ''}`)
  }
}
const messages = (list) => list.map((e) => `${e.path}: ${e.message}`).join('\n')

const contract = loadContract()
const contractErrors = validateContract(contract)
expect('schema/haxcms-site-contract.json follows site-contract.schema.json', contractErrors.length === 0, messages(contractErrors))
expect('contract check catches a duplicate path and an unknown level', (() => {
  const broken = JSON.parse(JSON.stringify(contract))
  broken.entries.push(Object.assign({}, broken.entries[0], { level: 'nowhere' }))
  const text = messages(validateContract(broken))
  return text.includes('duplicate path') && text.includes('unknown level')
})())

const { classify } = compileContract(contract)
const owners = {
  'site.json': 'authored',
  'pages/a/index.html': 'authored',
  'pages/a/index.md': 'generated',
  'pages/a/notes/draft.txt': 'authored',
  'files/photos/cat.jpg': 'authored',
  'files/.htaccess': 'managed',
  'robots.txt': 'partly-managed',
  build: 'deployment',
  'build/es6/node_modules/x.js': 'deployment',
  'custom/src/custom.js': 'scaffold',
  'custom/src/my-theme.js': 'authored',
  'assets/babel-top.js': 'deployment',
  'assets/logo.svg': 'authored'
}
for (const [file, owner] of Object.entries(owners)) {
  const entry = classify(file)
  expect(`contract: ${file} is ${owner}`, !!entry && entry.owner === owner, `got ${entry ? entry.owner : 'no entry'}`)
}
expect('contract: theme/ is retired at any depth', classify('theme/theme.css').status === 'retired' && classify('theme/a/b.css').status === 'retired')
expect('contract: * does not cross a folder', classify('pages/a/b/index.html').path === 'pages/**')
expect('contract: an unknown root file has no entry', classify('notes.txt') === null)

const exampleSite = path.join(root, 'examples', 'site-folder')
const atContent = validateSiteFolder(exampleSite, { validators })
expect('examples/site-folder reaches the content level', atContent.valid && atContent.reached === 'content', messages(atContent.errors))
const atRunnable = validateSiteFolder(exampleSite, { level: 'runnable', validators })
expect('examples/site-folder is not runnable without the loader files', !atRunnable.valid && ['index.html', 'build.js', 'build-haxcms.js'].every((f) => messages(atRunnable.errors).includes(`${f}: required at the runnable level`)), messages(atRunnable.errors))

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'jos-site-folder-'))
const copyOfExample = (name, change) => {
  const dir = path.join(scratch, name)
  fs.cpSync(exampleSite, dir, { recursive: true })
  change(dir)
  return dir
}
const editManifest = (dir, change) => {
  const file = path.join(dir, 'site.json')
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
  change(doc)
  fs.writeFileSync(file, JSON.stringify(doc))
}
try {
  let r = validateSiteFolder(copyOfExample('missing-page', (dir) => fs.rmSync(path.join(dir, 'pages', 'about', 'index.html'))), { validators })
  expect('site folder: a missing page file fails the content level', !r.valid && r.reached === null && messages(r.errors).includes('page file for item "about" is missing'), messages(r.errors))

  r = validateSiteFolder(copyOfExample('escaping-location', (dir) => editManifest(dir, (doc) => { doc.items[1].location = '../outside/index.html' })), { validators })
  expect('site folder: a location outside the site is refused', !r.valid && messages(r.errors).includes('must be a relative path inside the site'), messages(r.errors))

  r = validateSiteFolder(copyOfExample('bad-manifest', (dir) => editManifest(dir, (doc) => { doc.items[1].parent = 'nobody' })), { validators })
  expect('site folder: site.json errors are reported', !r.valid && messages(r.errors).includes('site.json#/items/1/parent'), messages(r.errors))

  r = validateSiteFolder(copyOfExample('broken-json', (dir) => fs.writeFileSync(path.join(dir, 'site.json'), '{')), { validators })
  expect('site folder: unreadable site.json fails', !r.valid && messages(r.errors).includes('cannot read JSON'), messages(r.errors))

  r = validateSiteFolder(copyOfExample('no-manifest', (dir) => fs.rmSync(path.join(dir, 'site.json'))), { validators })
  expect('site folder: site.json is required', !r.valid && messages(r.errors).includes('site.json: required at the content level'), messages(r.errors))

  const withRetired = copyOfExample('retired', (dir) => {
    fs.mkdirSync(path.join(dir, 'theme'))
    fs.writeFileSync(path.join(dir, 'theme', 'theme.css'), '')
  })
  r = validateSiteFolder(withRetired, { validators })
  expect('site folder: a retired path only warns on an existing site', r.valid && r.retired.includes('theme/theme.css') && messages(r.warnings).includes('replaced by custom/'), messages(r.warnings))
  r = validateSiteFolder(withRetired, { isNew: true, validators })
  expect('site folder: a retired path fails a new site', !r.valid && messages(r.errors).includes('theme/theme.css: retired'), messages(r.errors))

  const withStray = copyOfExample('stray', (dir) => fs.writeFileSync(path.join(dir, 'notes.txt'), ''))
  r = validateSiteFolder(withStray, { validators })
  expect('site folder: an uncovered file is listed, not failed', r.valid && r.unclassified.join() === 'notes.txt')
  r = validateSiteFolder(withStray, { exhaustive: true, validators })
  expect('site folder: an uncovered file fails when exhaustive', !r.valid && messages(r.errors).includes('notes.txt: not covered by any contract entry'), messages(r.errors))

  const ignored = copyOfExample('ignored', (dir) => {
    fs.mkdirSync(path.join(dir, '.git'))
    fs.writeFileSync(path.join(dir, '.git', 'HEAD'), '')
    fs.mkdirSync(path.join(dir, 'node_modules'))
    fs.writeFileSync(path.join(dir, 'node_modules', 'x.js'), '')
  })
  r = validateSiteFolder(ignored, { exhaustive: true, validators })
  expect('site folder: .git and node_modules are not walked', r.valid, messages(r.errors))

  r = validateSiteFolder(path.join(scratch, 'does-not-exist'), { validators })
  expect('site folder: a missing folder fails', !r.valid && messages(r.errors).includes('not a folder'))

  const boilerplate = path.join(scratch, 'boilerplate')
  fs.mkdirSync(path.join(boilerplate, 'theme'), { recursive: true })
  for (const entry of contract.entries) {
    if (entry.boilerplate !== true || entry.path.includes('*') || entry.path === 'README.md') continue
    fs.mkdirSync(path.dirname(path.join(boilerplate, entry.path)), { recursive: true })
    fs.writeFileSync(path.join(boilerplate, entry.path), '')
  }
  fs.writeFileSync(path.join(boilerplate, 'new-file.txt'), '')
  fs.writeFileSync(path.join(boilerplate, 'theme', 'theme.css'), '')
  const drift = compareBoilerplate(boilerplate, contract)
  expect('boilerplate comparison reports missing, extra and retired paths', drift.missing.join() === 'README.md' && drift.extra.join() === 'new-file.txt' && drift.retired.join() === 'theme/theme.css', JSON.stringify(drift))
} finally {
  fs.rmSync(scratch, { recursive: true, force: true })
}

process.exitCode = failures ? 1 : 0
