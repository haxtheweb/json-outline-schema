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
- `metadata` - area to storing any additional details about the work. This has no standard structure but could be used for relating work if needed.
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
- `metadata` - a container for any additional details of information you need to ship. This has no standard structure

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
  "theme": { /* visual metadata for dashboards */ }
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
      "category": ["Course"],
      "attributes": [],
      "demo-url": "#",
      "skeleton-url": ".../getSkeleton?name=online-course-clean-one&user_token=..."
    }
  ]
}
```

Each item in `data` is derived from the corresponding skeleton file's `meta` block. The `skeleton-url` field provides a ready-to-use URL for fetching the full skeleton JSON (see `getSkeleton` below).

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
    "theme": { /* visual metadata */ }
  }
}
```

If the `user_token` is invalid or missing, both endpoints return a 403-style response. If the named skeleton cannot be found, `getSkeleton` returns a 404-style response. Implementations search both core skeleton definitions (for example `coreConfig/skeletons`) and site-specific overrides (for example `_config/skeletons`) when resolving a skeleton file.
