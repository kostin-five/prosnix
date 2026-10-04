# Prosnix design direction

## Reference

The visual foundation is adapted from the Raycast DESIGN.md analysis:
https://getdesign.md/raycast/design-md

This is a reference direction, not a request to copy Raycast branding or product UI.

## Rules for new pages and components

- Use a near-black canvas: `#07080a`.
- Build depth with a surface ladder: `#0d0d0d`, `#101111`, `#121212`.
- Use 1px hairline borders around cards: `#242728` or a low-opacity white border.
- Prefer 6–10px radii for controls and cards. Use larger radii only for a deliberate hero element.
- Avoid large drop shadows, heavy gradients and decorative blur. Depth comes from surface steps and borders.
- Use Inter when available, with `font-feature-settings: "calt", "kern", "liga", "ss03"`.
- Keep body text muted and readable; reserve bright accents for actions, status and task illustration.
- Prosnix keeps its amber/orange accent for brand identity and wake actions. The primary home action may
  use a light Raycast-style surface when it improves contrast.
- Keep one clear primary action per view. Secondary actions should be transparent or use the elevated
  surface.
- Maintain 44px minimum touch targets and preserve readable layout at 320px wide.
- Respect `prefers-reduced-motion`; never make essential information depend on animation.
- Preserve Prosnix functions, Russian copy, legal links and Telegram WebView constraints.
