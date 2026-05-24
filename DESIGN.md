# Design System

TerraDiagnosis / 地脉·镜 design tokens and conventions.

## Brand

| Token | Value |
|-------|-------|
| Name | TerraDiagnosis · 地脉·镜 |
| Tagline | 推沙成世界，一镜诊山河 |
| Accent | `#e8945a` (amber) |
| Accent dim | `#b87040` |

## Colors

```css
:root {
  --bg:        #1a1816;   /* dark charcoal background */
  --surface:   rgba(255,255,255,0.12);  /* translucent surface */
  --text:      #e0ddd8;   /* warm off-white */
  --text-dim:  #8a8680;   /* muted text */
  --accent:    #e8945a;   /* amber accent */
  --accent-dim:#b87040;   /* darker amber */
  --border:    rgba(255,255,255,0.15);  /* subtle border */
  --radius:    10px;      /* standard border radius */
  --radius-sm: 6px;       /* small border radius */
}
```

## Typography

- **Primary**: DM Mono (monospace, for titles and headings)
- **Fallback**: monospace
- **Body text**: 0.78rem - 0.9rem
- **Headings**: 1.1rem - 1.5rem

## Spacing

4px base grid scale. Common increments: 8px, 12px, 16px, 24px, 32px, 40px.

## Border Radius

- Small: 6px (buttons, inputs)
- Standard: 10px (panels, cards)

## Z-Index Layers

| Layer | z-index | Usage |
|-------|---------|-------|
| Canvas | 0 | 3D scene |
| Hints | 5 | Edit mode hints, onboarding |
| Panels | 10 | Onboarding card |
| Overlays | 20 | Progress overlay, lock button |
| Notifications | 100-200 | Toast, WebGL overlay |

## Component Conventions

- Buttons: 6px radius, amber accent on hover, 0.15s transition
- Panels: translucent surface with blur, 10px radius, subtle border
- Icons: Custom SVG inline, 20-32px viewport
- Text: DM Mono for headings, monospace fallback

## Interaction

- Transitions: 0.15s (buttons), 0.3s (panels, notifications)
- Hover: Scale transform 1.02 for buttons
- Active/Selected: Accent color filled background
- Disabled/Inactive: Dimmed (--text-dim)
