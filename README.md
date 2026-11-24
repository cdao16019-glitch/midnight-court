# 夜のコート — Midnight Court

A miniature diorama-style nighttime roadside basketball court in Three.js, rendered in a
Japanese anime style (cel/toon shading + ink outlines):

- chain-link fenced court with a gate, two hoops, a worn / patchy / cracked court surface
- dark night lit by two warm streetlights (with glow sprites and flicker), moonlight and stars
- a basketball lying on the empty court
- a cherry blossom tree in the corner — move the mouse and gusts of wind scatter the petals
- roadside props: vending machine, trash bin, sidewalk, road with lane dashes, utility pole with wires, lit apartment buildings in the background

## Run

Three.js r160 is vendored in `vendor/`, so no network is needed. Either open
`index.html` directly in a browser, or serve the folder:

```
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Files

- `index.html` — page, import map, title/hint overlay, vignette
- `main.js` — the whole scene (procedural canvas textures, toon materials, outlines, petal system)
- `vendor/three.module.js` — Three.js r160
