Expedition item drop icons go in this folder.

Naming scheme:
- Convert item id to lowercase
- Replace any non-alphanumeric character with a hyphen
- Collapse repeated separators
- Use .png extension

Examples:
- part:raft:sail:patched-cloth -> part-raft-sail-patched-cloth.png
- ship:sloop:keel-plan -> ship-sloop-keel-plan.png
- map:abyssal-atlas -> map-abyssal-atlas.png

Optional placeholder:
- unknown.png for hidden collection entries

Recommended art spec:
- 64x64 transparent PNG minimum
- 128x128 source export optional

Fallback behavior:
- If icon file is missing or fails to load, the UI shows a text token fallback.
