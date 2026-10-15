#!/usr/bin/env node
/**
 * Self-test: every valid example must pass and every file in
 * examples/invalid must fail with the expected messages.
 */
const fs = require('fs')
const path = require('path')
const { buildValidators, detectType, validateDoc } = require('./validate.js')

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
  'indent/order should be integers'
])
check('examples/invalid/missing-parent.json', false, ['does not match any item id'])
check('examples/invalid/cycle-and-duplicates.json', false, ['duplicate id', 'duplicate slug', 'cycle'])
check('examples/invalid/haxcms-unknown-item-key.json', false, ['"content"', 'novice, expert'])

if (fs.readdirSync(path.join(root, 'examples', 'invalid')).length !== 3) {
  failures++
  console.log('FAIL examples/invalid has files without an expectation in scripts/test.js')
}
process.exitCode = failures ? 1 : 0
