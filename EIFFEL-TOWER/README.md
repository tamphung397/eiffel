# EIFFEL TOWER IN ASCII

*An ASCII animation by [@dwcminh.ascii](https://instagram.com/dwcminh.ascii) (2026)*

![EIFFEL TOWER IN ASCII](preview.gif)

## The idea

A night street in Paris, seen from eye level, with the Eiffel Tower at the end of it.
The tower grows out of the ground in blue steel, girder by girder: the four legs, the arches,
the two platforms, the column, the summit. Then its golden lights switch on from the bottom up,
the searchlight on top starts sweeping the sky, white bulbs sparkle all over it and fireworks
go up behind the rooftops, while small figures stroll along the wet pavement.

## How it's made

- **The tower:** a 3D model built at real scale (330 m), with lattice faces, cross-braces, arches and decks. Each piece knows the moment it should appear, so the heavy base rises slowly and the top quickly.
- **The street:** a camera at eye height, 444 m away. House fronts, windows, lamps and trees are traced cell by cell, and the wet road mirrors the tower with rippling reflections.
- **Picking characters:** girders and braces use the stroke that follows their direction on screen (`- / | \`). Solid shapes get an outline and are filled with letters chosen by brightness.
- **Lighting up:** gold sweeps up the tower with a white edge. New platforms and arches flash white-hot, then cool down.
- **Sky:** a two-beam searchlight, rockets that burst into falling sparks, twinkling stars.
- **Rendering:** a character grid drawn with a soft double glow and fading trails.

Built with Python, NumPy and pygame-ce.

## Run in a browser

Serve this folder with any static web server (for example, `python -m http.server 8000`)
and visit `http://localhost:8000`; serving it over HTTP also lets the browser load the MP3.
The browser version does not require Python packages. It recreates the animation in Canvas;
its seeded procedural details may differ slightly from the Python renderer.
The page attempts to autoplay `YouTube.mp3`; if the browser blocks autoplay, tap the music
button in the upper-right corner to start or stop playback.

Keys: `Space` pause · `R` restart · `S` save a screenshot

## Deploy on GitHub Pages

The [deployment workflow](../.github/workflows/deploy-eiffel.yml) publishes the HTML, renderer,
and MP3 when changes are pushed to `master`. In the repository settings, set **Pages → Build
and deployment → Source** to **GitHub Actions**. The workflow can also be started manually
from the Actions tab.

## Run it

```
pip install -r requirements.txt
python eiffel_tower.py
```

Keys: `Space` pause · `R` restart · `S` save a screenshot · `Esc` exit

## Using this code

The source is free for personal use. If you post something you made with it, a mention of
@dwcminh.ascii would be appreciated. The full terms are in LICENSE.txt.

---

Made by [@dwcminh.ascii](https://instagram.com/dwcminh.ascii) on Instagram.
The images and video in this folder belong to @dwcminh.ascii. Please ask before reusing them.
