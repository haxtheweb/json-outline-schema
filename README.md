# JSON Outline Schema

JSON Outline Schema is a standard way of expressing and storing the relation between objects. It gives you a simple way of linking data together to form an outline of related concepts / entities. Here is an example of a JSON Outline schema entity:
```json
{
  "id": "unique-id-of-the-item-1",
  "indent": "1",
  "location": "name-of-some-file-or-location.html",
  "slug": "name-of-some-path-in-the-url",
  "order": "0",
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
      "indent": "1",
      "location": "outline.html",
      "slug": "outline",
      "order": "0",
      "parent": null,
      "title": "Outline",
      "description": "A description at a glance of this item potentially",
      "metadata": {
        "icon": "icons:view-quilt"
      }
    },
    {
      "id": "item-2",
      "indent": "2",
      "location": "introduction.html",
      "slug": "introduction",
      "order": "0",
      "parent": "item-1",
      "title": "Introduction to outlines",
      "description": "A description at a glance of this item potentially",
      "metadata": {}
    },
    {
      "id": "item-3",
      "indent": "2",
      "location": "files/a-2nd-page-item.html",
      "slug": "a-2nd-page-item",
      "order": "1",
      "parent": "item-1",
      "title": "An item in an outline",
      "description": "A description at a glance of this item potentially",
      "metadata": {}
    }
  ]
}
```

Let's break down thes properties and why we have them in the schema:
## Higher order schema
- `title` - name of the work as a whole
- `author` - who created this work
- `description` - short description of the work to explain it
- `license` - a valid license short hard for the work as a whole
- `metadata` - area to storing any additional details about the work. Core JSON Outline Schema intentionally keeps this open-ended; downstream systems (like HAXcms) define practical conventions in this area.
- `id` - a unique identifier for this work in the universe of all works
- `items` - an array of schema elements which contain the pages / leaves of the structure of this outline

## Leaf / page element within the structure
- `id` - the UUID / unique ID of the element
- `indent` - How far to visually position the item inward. You could have something be the parent as a page but visually only be indented 2 levels
- `location` - a file or resource that references the related data to display here
- `slug` - a uri portion that is how this resource should be presented on the web. Can be same as location but allows abstraction away from the actual location of the file via this attribute
- `order` - a weighting as to the order relative to other items that match this parent level
- `parent` - a UUID / unique ID of the element this is a child of
- `title` - title of this item to display
- `description` - short description of the item to explain it
- `metadata` - a container for any additional details of information you need to ship. This has no standard structure in core JSON Outline Schema.

## HAXcms metadata conventions layered on JSON Outline Schema

JSON Outline Schema is intentionally flexible about `metadata`. In practice, HAXcms uses stable metadata groups that are important to document for interoperability (including ingest into systems like PRAW), even though these groups are not formally required by JOS itself.

### `metadata.site`

Holds site-level information and operational settings used by HAXcms:

- `name` - machine name for the site (folder / instance alignment).
- `created` / `updated` - unix timestamps.
- `logo`, `domain`, `tags`, `homePageId` - common site metadata values.
- `settings` - feature flags and runtime behavior (for example `lang`, `publishPagesOn`, `canonical`, `pathauto`, `sw`, `forceUpgrade`, `gaID`).
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

- `audience` - currently `novice` or `expert`.
- `features` - boolean map of platform capabilities (for example `addPage`, `deletePage`, `outlineDesigner`, `styleGuide`, `insights`, `manifest`, `pageBreak`, `addBlock`, `contentMap`, `viewSource`, `onlineSearch`).
- `allowedBlocks` - array of allowed HTML tags / registered web-component tag names.

Current compatibility support in HAXcms also accepts legacy keys:

- `delete` mapped to modern `features.deletePage`
- `blocks` mapped to modern `allowedBlocks`

### `metadata.node`

Used for node/page-level field configuration metadata, commonly initialized as:

- `metadata.node.fields` - object storing node field definitions and related data.

### How platform settings affect block behavior

HAXcms uses `metadata.platform` directly in editor runtime decisions:

- Block registration marks blocks as restricted when `platformAllows(tag)` is false.
- `features.addBlock = false` prevents block insertion UI actions.
- `allowedBlocks` filters available insertable blocks.
- Required primitive text tags remain available even when block restrictions apply.
- In `expert` audience mode, an empty `allowedBlocks` list defaults to allowing all blocks; in non-expert modes, block access is enforced by `allowedBlocks`.

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

- `name` – machine-readable key used as the skeleton file name (and as the `name` query value).
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

#### `build`

Defines how to generate the site from the skeleton. This is where Skeleton API directly builds on JSON Outline Schema:

- `type` – build type, usually `"skeleton"`.
- `structure` – strategy for constructing the site (for example `"from-skeleton"`).
- `items` – array of outline items that closely match the JSON Outline Schema leaf/page structure (see below).
- `files` – optional array of additional files to create or copy into the new site.

Each entry in `build.items` typically has:

- `id` – UUID/unique ID of the element.
- `title` – title of the page to display.
- `slug` – URI portion for this resource (maps to the page URL).
- `order` – ordering weight relative to siblings.
- `parent` – ID of the parent item (or `null` for top-level pages).
- `indent` – visual indentation level (mirrors the JSON Outline Schema `indent` concept).
- `content` – initial HTML content to seed the generated page.
- `metadata` – arbitrary key/value data for the page (for example `published`, `hideInMenu`, `tags`).

These `items` can be thought of as an extended JSON Outline Schema: they express the same outline relationships while also providing initial page content and richer per-page metadata.

#### `theme`

Provides theme-specific visual metadata used by dashboards and selection UIs:

- `hexCode` – primary color hex code for preview tiles.
- `cssVariable` – CSS custom property reference for the theme color.
- `icon` – icon identifier representing the skeleton.
- `image` – path/URL to a preview image for the skeleton.

#### `_skeleton` (optional but increasingly important for ingestion)

This non-required block is currently used by HAXcms skeleton export workflows to preserve source metadata for downstream systems:

- `originalMetadata` – extracted source metadata groups, including `site`, `platform`, `node`, and licensing information.
- `originalSettings` – extracted `metadata.site.settings`.
- `fullThemeConfig` – expanded theme configuration snapshot.

When present, `_skeleton.originalMetadata.platform` carries the same platform settings model described above, which lets consumers understand block-level and feature-level restrictions without reconstructing them from UI state.

### Suggested Skeleton API adjustments for clearer JOS/PRAW interoperability

These are recommended improvements to keep Skeleton API data easier to ingest and reason about:

1. **Promote platform metadata to a first-class top-level field**
   - Add optional top-level `platform` in skeleton payloads.
   - Keep `_skeleton.originalMetadata.platform` as compatibility source during transition.
2. **Document a normalized platform schema**
   - Canonical shape: `{ audience, features, allowedBlocks }`.
   - Keep legacy read support for `{ delete, blocks }` but avoid writing legacy keys in new skeletons.
3. **Expose richer list metadata from `skeletonsList`**
   - Keep returning `machineName` / `machine-name` and `priority` for predictable client sorting and lookup.
   - Continue omitting internal fallback skeletons (such as `default-starter`) from public selections.
4. **Document metadata pass-through expectations explicitly**
   - Clarify that site creation and manifest editing should preserve `metadata.platform` rather than dropping or flattening it.
   - Clarify that block restrictions should be interpreted from platform metadata, not inferred heuristically.
5. **Version extension blocks**
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

Each item in `data` is derived from the corresponding skeleton file's `meta` block. The `skeleton-url` field provides a ready-to-use URL for fetching the full skeleton JSON (see `getSkeleton` below). The list intentionally excludes internal fallback skeletons such as `default-starter`.

#### `GET /getSkeleton`

Returns the full JSON definition of a single skeleton.

**Query parameters**

- `name` – required skeleton file key (usually the `meta.name` value, without the `.json` extension).
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
