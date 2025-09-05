# README Draft Outline (v2 simplified API)

- Overview
  - What this is; how projection and lights synchronize
- Quick Start
  - Start dev server, open ShowRunner
  - Your first scene with look()/scene()/show()
- Concepts
  - Fixtures & groups (predefined + custom)
  - Looks, Scenes, Shows
  - Default pipeline: draw first, then lights
- Lights Facade
  - all/group/fixture selectors
  - rgb/master; off/blackout
  - Patterns: chase, pulse, sparkle, strobe (safety)
  - Custom patterns
- Time Helpers (t)
  - cycle/pulse/beat/step
- Projection Integration
  - scene.visual { init, update, draw }
  - sample(x,y) color -> lights
  - Contrast & WCAG notes
- Accessibility
  - Strobe safety defaults
  - Keyboard controls
- Advanced
  - Escape hatch to UniverseWriter
  - Extending groups
  - Future channels (rgb macro, strobe, mode)

