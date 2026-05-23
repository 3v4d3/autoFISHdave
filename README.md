# D.A.V.E. AutoFish — The Sovereign Catch
### HDA Mesh Hub · v3.1

> *Would you like fresh fish for dinner?*

A fully self-contained interactive product brochure for **D.A.V.E. AutoFish** — a sovereign autonomous multi-sensor harvest architecture for discerning maritime operators.

Single HTML file. Zero dependencies. Zero build steps. Zero cloud infrastructure. Consistent with the product philosophy.

---

## What's in here

| Feature | Description |
|---|---|
| Interactive ROE Simulator | Live pipeline animation across three target scenarios — Mahi, Sea Bass, and a classified third contact |
| Yield Calculator | Real-time Charter vs. Sovereign tier comparison with break-even analysis |
| Fleet Registry | HDA-3 · HDA-7 · HDA-9 specifications |
| Light / Dark mode | Toggleable. Defaults to the correct choice. |
| Easter egg | There is a notes field. |

---

## Deploy

### GitHub Pages (recommended)

```bash
git clone https://github.com/YOUR_USERNAME/autofish
cd autofish
# drop your changes into index.html
git add .
git commit -m "update"
git push
```

Enable Pages under **Settings → Pages → Source: main / root**.  
Live at: `https://YOUR_USERNAME.github.io/autofish`

### Netlify Drop

Drag `index.html` onto [app.netlify.com/drop](https://app.netlify.com/drop). Done.

### Local

```bash
open index.html
```
No server required.

---

## Maintenance notes

The entire site lives in `index.html`. Structure:

```
index.html
  ├── <style>          CSS variables, all layout, dark/light themes, egg overlay
  ├── <body>           Sections: hero → philosophy → simulation → safety →
  │                    fleet → yield-calc → protocol → pricing → disclaimer → footer
  └── <script>         yachtImages[], toggleTheme(), executeSimulation(),
                       updateYield(), story engine (STORY{} + renderNode())
```

**To update pricing:** search `0.50` (Charter rate) and `499` (Sovereign monthly).  
**To add a ROE scenario:** extend the `targetData` object and add a button in the simulator section.  
**To add a story node:** extend the `STORY` object. Nodes are plain JS objects — `scene[]`, `choices[]`, optional `ending` flag.  
**To update hero images:** edit the `yachtImages[]` array. Unsplash direct URLs work out of the box.

---

## Credits

**Software architecture & art direction** © David Horn  
Carbon-based lifeform. Vienna, Austria.

**Co-created with** Claude Sonnet 4.6 (Anthropic)

*D.A.V.E. AutoFish does not include an actual yacht or any physical hardware whatsoever.*

---

## License

All rights reserved. © David Horn.  
Not open source. Not a fishery. Not responsible for dolphins.
