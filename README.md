# JSON Outline Schema

## Onboarding

New to the HAX ecosystem? **[Start here](https://github.com/haxtheweb/issues/blob/master/CONTRIBUTING.md)** — the single onboarding guide covers prerequisites, cloning the core repos, installing, and running each project locally.

JSON Outline Schema is a standard way of expressing and storing the relation between objects. It was designed for, and is implemented by, [HAXcms](https://github.com/haxtheweb/haxcms-nodejs): a HAXcms `site.json` is a JSON Outline Schema document, so this repository documents both the core spec and the HAXcms conventions layered on it. It gives you a simple way of linking data together to form an outline of related concepts / entities. Here is an example of a JSON Outline schema entity:
```json
{
  "id": "unique-id-of-the-item-1",
  "indent": 1,
  "location": "name-of-some-file-or-location.html",
  "slug": "name-of-some-path-in-the-url",
  "order": 0,
  "parent": "unique-id-of-the-parent",
  "title": "Name of some file or location",
  "metadata": {}
}
```
This gives you enough data to visually represent this information in an outline form. Let's look at a larger example of 3 items related together which would express nested hierarchy in a consistent way:
```json
{
  "id": "123-ddc-d321d-d2e-dd2",
  "title": "My outline",
  "author": "LRNWebComponents",
  "description": "A series of related material to teach you about the structure of content.",
  "license": "by-sa",
  "metadata": {},
  "items": [
    {
      "id": "item-1",
      "indent": 0,
      "location": "outline.html",
      "slug": "outline",
      "order": 0,
      "parent": null,
      "title": "Outline",
      "description": "A description at a glance of this item potentially",
      "metadata": {
        "icon": "icons:view-quilt"
      }
    },
    {
      "id": "item-2",
      "indent": 1,
      "location": "introduction.html",
      "slug": "introduction",
      "order": 0,
      "parent": "item-1",
      "title": "Introduction to outlines",
      "description": "A description at a glance of this item potentially",
      "metadata": {}
    },
    {
      "id": "item-3",
      "indent": 1,
      "location": "files/a-2nd-page-item.html",
      "slug": "a-2nd-page-item",
      "order": 1,
      "parent": "item-1",
      "title": "An item in an outline",
      "description": "A description at a glance of this item potentially",
      "metadata": {}
    }
  ]
}
```

Let's break down these properties and why we have them in the schema:
## Higher order schema
- `title` - name of the work as a whole
- `author` - who created this work
- `description` - short description of the work to explain it
- `license` - a valid license short-hand for the work (HAXcms understands `by`, `by-sa`, `by-nd`, `by-nc`, `by-nc-sa`, `by-nc-nd`) as a whole
- `metadata` - area to storing any additional details about the work. Core JSON Outline Schema intentionally keeps this open-ended; downstream systems (like HAXcms) define practical conventions in this area.
- `id` - a unique identifier for this work in the universe of all works
- `items` - an array of schema elements which contain the pages / leaves of the structure of this outline

## Leaf / page element within the structure
- `id` - the UUID / unique ID of the element
- `indent` - How far to visually position the item inward (integer, `0` = top level). It normally equals the item's depth in the tree, but it is a display hint: derive hierarchy from `parent`, never from `indent`
- `location` - a file or resource that references the related data to display here
- `slug` - a uri portion that is how this resource should be presented on the web. Can be same as location but allows abstraction away from the actual location of the file via this attribute. Must be unique in the outline, never starts with `/`, and may contain `/` (HAXcms builds `parent-slug/child-slug` when `pathauto` is on)
- `order` - integer weighting relative to the other items that share the same `parent` (0-based)
- `parent` - the `id` of the element this is a child of, or `null` for a top-level item
- `title` - title of this item to display
- `description` - short description of the item to explain it
- `metadata` - a container for any additional details of information you need to ship. This has no standard structure in core JSON Outline Schema. HAXcms drops any item key that is not listed above when it saves, so anything extra belongs in `metadata`.

## Machine-readable schemas and validation

The prose in this README is backed by [JSON Schema (draft 2020-12)](https://json-schema.org/) files that tools, editors and AI agents can load directly:

| Schema | Validates |
| --- | --- |
| [`schema/json-outline-schema.schema.json`](schema/json-outline-schema.schema.json) | Any JSON Outline Schema document (core spec only) |
| [`schema/haxcms-site.schema.json`](schema/haxcms-site.schema.json) | A HAXcms `site.json` (core + the `metadata` conventions below) |
| [`schema/skeleton.schema.json`](schema/skeleton.schema.json) | A HAXcms site skeleton (see [Skeleton API](#skeleton-api)) |

JSON Schema cannot express cross-item rules, so `scripts/validate.js` adds them: unique `id`s, `parent` pointing at a real item, no parent cycles, unique `slug`s, plus warnings for `indent` that disagrees with tree depth, repeated sibling `order`, legacy value forms (string numbers, `"1"`/`""` flags, comma-separated `tags`), `relatedItems` that point nowhere, and non-standard `location` paths.

From npm (no install needed):

```bash
npx -p @haxtheweb/json-outline-schema-spec jos-validate path/to/site.json
```

The schemas ship in the package too (`@haxtheweb/json-outline-schema-spec/schema/haxcms-site.schema.json`, ...) for tools that validate in-process.

From a clone:

```bash
npm install
node scripts/validate.js path/to/site.json              # type is auto-detected
node scripts/validate.js --type skeleton my-skeleton.json
node scripts/validate.js --json site.json               # machine-readable report
npm test                                                # self-test against examples/
```

Examples: [`example.json`](example.json) (HAXcms site), [`examples/minimal.json`](examples/minimal.json) (smallest valid outline), [`examples/skeleton.json`](examples/skeleton.json), [`examples/legacy-values.json`](examples/legacy-values.json) (older value forms that are still readable but should never be written), and [`examples/invalid/`](examples/invalid) (one file per mistake the validator catches).

## Rules for tools and agents that write outlines

These are the things that most often go wrong when a program (or an AI agent) edits `site.json` by hand:

1. **The tree is `parent` + `order`, nothing else.** Top-level items have `"parent": null` (not `""`). `order` is a 0-based integer among siblings. Array position and `indent` are not authoritative.
2. **Keep `indent` equal to depth** (0 for top level) when you add or move items. `indent` may intentionally differ from depth when an outline wants a different presentation than its hierarchy (for example, sibling pages shown at different indents), but that is rare; never introduce drift unless asked.
3. **Every `id` and every `slug` must be unique.** Never reuse an id after deleting an item.
4. **Do not invent item keys.** HAXcms keeps only `id`, `indent`, `location`, `slug`, `order`, `parent`, `title`, `description` and `metadata`; anything else (for example `content`) is silently dropped on the next save. Page HTML lives in the file at `location` (HAXcms: `pages/<id>/index.html`).
5. **Write canonical types:** integers for `indent` / `order` / timestamps, `true` / `false` for flags such as `metadata.published` and `metadata.hideInMenu` (never `"1"`, `1` or `""`), and arrays for `tags` and `relatedItems`. HAXcms normalizes to these forms on save; readers must still accept the legacy forms found in older sites.
6. **Prefer the HAX CLI or HAXcms endpoints** over hand edits when they are available; they also update `pages/`, regenerate computed metadata, and rebuild derived files. Validate with `scripts/validate.js` after any hand edit.

## HAXcms metadata conventions layered on JSON Outline Schema

JSON Outline Schema is intentionally flexible about `metadata`. In practice, HAXcms uses stable metadata groups that are important to document for interoperability (including ingest into systems like PRAW), even though these groups are not formally required by JOS itself.

### `metadata.site`

Holds site-level information and operational settings used by HAXcms:

- `name` - machine name for the site (folder / instance alignment).
- `created` / `updated` - unix timestamps.
- `logo`, `domain`, `homePageId` - common site metadata values.
- `tags` - array of strings (older sites store a comma-separated string).
- `settings` - feature flags and runtime behavior (for example `lang`, `publishPagesOn`, `canonical`, `pathauto`, `private`, `sw`, `forceUpgrade`, `gaID`).
- `git` - optional publishing/deployment information.

### `metadata.theme`

Describes the active theme and theme-level settings:

- `element` - theme element tag (for example `clean-one`).
- `path` / `name` - theme module metadata (when present).
- `variables` - visual tokens like `hexCode`, `cssVariable`, `icon`, `image`, `imageAlt`, `imageLink`.
- `regions` - optional region-to-node mappings used by theme layouts.
- `styleGuide` - optional external style-guide URL (if set, HAXcms treats style-guide editing as external).

### `metadata.platform` (HAX editor / CMS behavior controls)

Stores audience, feature toggles, and block-allow lists used to constrain editing behavior in HAXcms:

- `audience` - `novice` or `expert` (defaults to `expert` when missing). Used to tailor UI; it does not change how `allowedBlocks` is interpreted.
- `features` - boolean map of platform capabilities. A **missing key means enabled**; only an explicit `false` turns a feature off. Keys HAXcms currently recognizes: `addPage`, `saveAndEdit`, `deletePage`, `styleGuide`, `outlineDesigner`, `insights`, `siteManifest`, `themeManifest`, `authorManifest`, `seoManifest`, `addBlock`, `contentMap`, `viewSource`, `uploadMedia`, `onlineMedia`, `pageBreak`, `pageTemplates`, `blockTemplates`, `popularGizmos`, `recentGizmos`, `community`, `views` (source of truth: `__supportedFeatures` in `haxcms-site-store.js`).
- `allowedBlocks` - allow-list of optional block tags (HTML tags / registered web-component tag names):
  - missing or `[]` - no allow-list defined, every block is allowed
  - `null` - no optional blocks are allowed
  - `["media-image", ...]` - only these tags (plus the required primitive text tags)

Current compatibility support in HAXcms also accepts legacy keys:

- `delete` mapped to modern `features.deletePage`
- `blocks` mapped to modern `allowedBlocks`
- feature booleans written directly on `platform` (for example `platform.addPage`) are folded into `features`

New data should only use `audience`, `features` and `allowedBlocks`.

### `metadata.author` and `metadata.build`

- `metadata.author` - site author profile shown by themes: `name`, `email`, `image`, `socialLink`.
- `metadata.build` - written once at site creation: `version`, `structure` (for example `course`, `from-skeleton`), `type`.

### Item metadata (`items[].metadata`)

Per-page keys HAXcms reads and writes:

- `published` - page is visible to visitors (missing = published).
- `hideInMenu` - keep the page out of navigation but reachable by URL.
- `locked` - prevent editing in the HAX editor.
- `created` / `updated` - unix timestamps (seconds).
- `tags` - array of strings. The editor collects tags as a comma-separated list and converts it to an array; older sites store the raw string.
- `pageType` - what kind of page this is (for example `Lesson`, `Quiz`, `Assessment`). Primarily used to map pages onto [OER Schema](https://oerschema.org/) classes.
- `relatedItems` - array of item ids for non-hierarchical relationships ("people who read this also read"). Hierarchy is always `parent`; `relatedItems` never implies nesting or order.
- `icon`, `image` - menu icon (`iconset:name`) and featured image.
- `theme` - per-page theme override, same shape as `metadata.theme`.
- `overridePathauto` - keep this page's slug even when `settings.pathauto` is on.
- Computed on save (writers can omit): `readtime`, `images`, `videos`, `files`, `contentDetails`.

### `metadata.node`

Used for node/page-level field configuration metadata, commonly initialized as:

- `metadata.node.fields` - object storing node field definitions and related data.

### How platform settings affect block behavior

HAXcms uses `metadata.platform` directly in editor runtime decisions:

- Block registration marks blocks as restricted when `platformAllows(tag)` is false.
- `features.addBlock = false` prevents block insertion UI actions.
- `allowedBlocks` filters available insertable blocks.
- Required primitive text tags remain available even when block restrictions apply.
- An empty or missing `allowedBlocks` allows all blocks in every audience; `null` allows none; a non-empty list is enforced as written.

## Skeleton API

The **Skeleton API** builds on JSON Outline Schema to describe reusable starter "skeletons" for HAXcms sites. A skeleton is a JSON document that combines:

- High-level metadata about the skeleton itself
- Initial HAXcms site settings (name, description, theme)
- A JSON Outline Schema–style outline of pages to create
- Optional theme and visual metadata for dashboards and UIs

Skeleton documents are stored as JSON files (for example in HAXcms `coreConfig/skeletons/`), and are delivered over HTTP via the `skeletonsList` and `getSkeleton` endpoints.

### Skeleton JSON structure

A typical skeleton JSON document has this top-level structure:

```json
{
  "meta": { /* skeleton metadata */ },
  "site": { /* site-level settings */ },
  "build": {
    "type": "skeleton",
    "structure": "from-skeleton",
    "items": [ /* outline items */ ],
    "files": []
  },
  "theme": { /* visual metadata for dashboards */ },
  "_skeleton": { /* optional export metadata from site-skeleton-generator */ }
}
```

#### `meta`

Describes the skeleton itself and how it should appear in UIs:

- `name` – machine-readable key. Keep it identical to the file name (without `.json`) and to `machineName`: `skeletonsList` reports the normalized file name as `machineName`, while `getSkeleton` accepts the file name, `meta.machineName` or `meta.name`.
- `machineName` – same as `name` (written by the generator).
- `priority` – sort weight in selection lists.
- `sourceUrl` – the site the skeleton was exported from (generator output).
- `description` – short description of what this skeleton is for.
- `version` – version of the skeleton definition.
- `created` – ISO 8601 timestamp of when the skeleton was created.
- `type` – usually `"skeleton"`.
- `useCaseTitle` – human-readable title shown in selectors (for example "Online Course").
- `useCaseDescription` – longer description for dashboards.
- `useCaseImage` – path/URL to a thumbnail image for this skeleton.
- `category` – array of category strings used for grouping/filtering.
- `tags` – array of tags describing the skeleton.
- `attributes` – optional array of additional attributes to surface in UIs.

#### `site`

Provides initial HAXcms site configuration:

- `name` – base site name (used for folder/instance naming).
- `description` – default description for the new site.
- `theme` – HAXcms theme identifier to apply to the generated site.
- `settings` – optional; copied into `metadata.site.settings` of the new site.
- `platform` – optional; copied into `metadata.platform` of the new site (same `{ audience, features, allowedBlocks }` model described above).

#### `build`

Defines how to generate the site from the skeleton. This is where Skeleton API directly builds on JSON Outline Schema:

- `type` – build type, usually `"skeleton"`.
- `structure` – strategy for constructing the site (for example `"from-skeleton"`).
- `items` – array of outline items that closely match the JSON Outline Schema leaf/page structure (see below).
- `files` – optional array of additional files to copy into the new site's `files/` directory. The generator writes `{ "path": "image.jpg" }` objects.

Each entry in `build.items` typically has:

- `id` – UUID/unique ID of the element.
- `title` – title of the page to display.
- `slug` – URI portion for this resource (maps to the page URL).
- `order` – ordering weight relative to siblings.
- `parent` – ID of the parent item (or `null` for top-level pages).
- `indent` – visual indentation level (mirrors the JSON Outline Schema `indent` concept).
- `content` – initial HTML content to seed the generated page.
- `metadata` – arbitrary key/value data for the page (for example `published`, `hideInMenu`, `tags`). In skeletons `tags` is an array.

Skeleton items have no `location`; HAXcms issues fresh ids and page files when it builds a site, and content can reference other items by these ids (elements with a `siteToSkeleton` haxHook rewrite their own references).

These `items` can be thought of as an extended JSON Outline Schema: they express the same outline relationships while also providing initial page content and richer per-page metadata.

#### `theme`

Provides theme-specific visual metadata used by dashboards and selection UIs. Hand-written skeletons use the tile fields below; skeletons exported by the generator also merge in theme config fields (`element`, `path`, `name`, `thumbnail`, `regions`, ...):

- `hexCode` – primary color hex code for preview tiles.
- `cssVariable` – CSS custom property reference for the theme color.
- `icon` – icon identifier representing the skeleton.
- `image` – path/URL to a preview image for the skeleton.

#### `_skeleton` (optional but increasingly important for ingestion)

This non-required block holds generator metadata. The current HAXcms site-skeleton-generator writes only:

- `fullThemeConfig` – `{ element, variables }` snapshot of the source site's theme.

Earlier drafts of this document also described `originalMetadata` / `originalSettings`; current exports carry that information in `site.settings` and `site.platform` instead.

### Suggested Skeleton API adjustments for clearer JOS/PRAW interoperability

These are recommended improvements to keep Skeleton API data easier to ingest and reason about:

1. **Promote platform metadata to a first-class field** — *done as `site.platform`* in current generator output; readers should still check `_skeleton.originalMetadata.platform` for older exports.
2. **Document a normalized platform schema**
   - Canonical shape: `{ audience, features, allowedBlocks }`.
   - Keep legacy read support for `{ delete, blocks }` but avoid writing legacy keys in new skeletons.
3. **Expose richer list metadata from `skeletonsList`**
   - Keep returning `machineName` / `machine-name` and `priority` for predictable client sorting and lookup.
   - Continue omitting internal fallback skeletons (such as `default-starter`) from public selections.
4. **Document metadata pass-through expectations explicitly**
   - Clarify that site creation and manifest editing should preserve `metadata.platform` rather than dropping or flattening it.
   - Clarify that block restrictions should be interpreted from platform metadata, not inferred heuristically.
5. **Version extension blocks** (still open; `meta.version` versions the skeleton content, not the format)
   - Add explicit versioning guidance for `_skeleton` and any top-level `platform` block so ingestion tools can branch safely over time.

### HTTP endpoints

Skeleton JSON documents are exposed via two HAXcms API endpoints, implemented in both the PHP (`Operations::skeletonsList` / `Operations::getSkeleton`) and Node.js backends.

#### `GET /skeletonsList`

Returns the list of available skeletons visible to the current user.

**Query parameters**

- `user_token` – required request token for the active user (same token used by other HAXcms CMS endpoints).

**Response shape (success)**

```json
{
  "status": 200,
  "data": [
    {
      "title": "Online Course",
      "description": "An online course skeleton using the Clean One theme with syllabus and lesson pages.",
      "image": "@haxtheweb/haxcms-elements/lib/theme-screenshots/theme-clean-one-thumb.jpg",
      "priority": 0,
      "category": ["Course"],
      "attributes": [],
      "machineName": "online-course-clean-one",
      "machine-name": "online-course-clean-one",
      "demo-url": "#",
      "skeleton-url": ".../getSkeleton?name=online-course-clean-one&user_token=..."
    }
  ]
}
```

Each item in `data` is derived from the corresponding skeleton file's `meta` block, except `machineName`, which is the normalized file name. The `skeleton-url` field provides a ready-to-use URL for fetching the full skeleton JSON (see `getSkeleton` below). The list intentionally excludes internal fallback skeletons such as `default-starter`.

#### `GET /getSkeleton`

Returns the full JSON definition of a single skeleton.

**Query parameters**

- `name` – required. Matched against the file name (without `.json`), `meta.machineName` and `meta.name`.
- `user_token` – required request token for the active user.

**Response shape (success)**

```json
{
  "status": 200,
  "data": {
    "meta": { /* skeleton metadata */ },
    "site": { /* site configuration */ },
    "build": { /* build instructions and outline items */ },
    "theme": { /* visual metadata */ },
    "_skeleton": { /* optional source metadata snapshot */ }
  }
}
```

If the `user_token` is invalid or missing, both endpoints return a 403-style response. If the named skeleton cannot be found, `getSkeleton` returns a 404-style response. Implementations search both core skeleton definitions (for example `coreConfig/skeletons`) and site-specific overrides (for example `_config/skeletons`) when resolving a skeleton file.

## Releasing

This package is versioned with the rest of the HAX ecosystem and is published by the ubiquity release (`scripts/ubiquity-push.sh` in haxtheweb/webcomponents), which runs `commit-and-tag-version --release-as <ecosystem version>`, pushes the tag and runs `npm publish`. To cut a release of just this package, run `npm run release` (tests, bumps the version and CHANGELOG, tags, pushes to `master`, publishes).
