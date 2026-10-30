JSON Outline Schema (JOS) is a standard way of expressing and storing the relationship between objects. It gives you a simple way of linking data together to form an outline of related concepts and entities—title, author, description, and a flat list of items that reference one another by parent ID.

HAXcms uses JOS as the backbone for every site's `site.json` manifest: the outline of pages, their order, their nesting, and a flexible `metadata` container that downstream systems (like HAXcms itself, and PRAW) layer their own conventions on top of.

This documentation covers three related things:

*   [Outline Structure](outline-structure) — the core JOS entity shape, and how items link together to form a tree.
*   [HAXcms Metadata Conventions](haxcms-metadata-conventions) — the practical `metadata.site`, `metadata.theme`, `metadata.platform`, and `metadata.node` groups HAXcms defines on top of JOS.
*   [Skeleton API](skeleton-api) and [Skeleton API HTTP Endpoints](skeleton-api-http-endpoints) — how JOS extends into reusable starter site templates ("skeletons") served over HTTP.

New to the HAX ecosystem? [Start with the onboarding guide](https://github.com/haxtheweb/issues/blob/master/CONTRIBUTING.md), which covers prerequisites, cloning the core repos, installing, and running each project locally.