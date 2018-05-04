# JSON Outline Schema

JSON Outline Schema is a standard way of expressing and storing the relation between objects. It gives you a simple way of linking data together to form an outline of related concepts / entities. Here is an example of a JSON Outline schema entity:
```
{
  id: "unique-id-of-the-item-1",
  indent: "1",
  location: "name-of-some-file-or-location.html",
  order: "0",
  parent: "unique-id-of-the-parent",
  title: "Name of some file or location"
}
```
This gives you enough data to visually represent this information in an outline form. Let's look at a larger example of 3 items related together which would express nested hierarchy:
```
[
  {
    "id": "item-1",
    "indent": "1",
    "location": "outline.html",
    "order": "0",
    "parent": null,
    "title": "Outline"
  },
  {
    "id": "item-2",
    "indent": "2",
    "location": "introduction.html",
    "order": "0",
    "parent": "item-1",
    "title": "Introduction to outlines"
  },
  {
    "id": "item-3",
    "indent": "2",
    "location": "files/a-2nd-page-item.html",
    "order": "1",
    "parent": "item-1",
    "title": "An item in an outline"
  }
]
```

Let's break down thes properties and why we have them in the schema:
- id - the UUID / unique ID of the element
- indent - How far to visually position the item inward. You could have something be the parent as a page but visually only be indented 2 levels
- location - a file or resource that references the related data to display here
- order - a weighting as to the order relative to other items that match this parent level
- parent - a UUID / unique ID of the element this is a child of
- title - title of this item to display
