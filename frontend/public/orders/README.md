# Order and inventory images

Drop image files in this folder. Vite serves it at the site root, so
`oak-dining-table.jpg` here is reachable at `/orders/oak-dining-table.jpg`.

## Naming

Each order and inventory row stores **only the filename**, in its `image`
field. Match the filenames already referenced in `src/mocks/db.js`:

```
oak-dining-table.jpg      walnut-writing-desk.jpg   ash-dining-chairs.jpg
oak-bookcase.jpg          cherry-sideboard.jpg      maple-bowl.jpg
walnut-board.jpg          oak-mirror.jpg            bespoke-shelving.jpg
kitchen-island.jpg
```

Any format a browser can display works — `.jpg`, `.png`, `.webp`. Square or
near-square crops look best; they are rendered small and cropped to fill.

## Until the files exist

Nothing breaks. `ItemImage` falls back to a generated wood-tone swatch with the
item's initials, so no row ever shows a broken-image icon. Add a file and it
appears on the next reload, with no code change.

`sample-placeholder.svg` is checked in only to prove the loading path works.
Delete it whenever you like.
