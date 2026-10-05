# Native capture cleanup

## Current screenshots — 2026-10-05

The five originals were captured in **native macOS full-screen mode** from the installed `/Applications/MarkFlowy.app`, version **0.103.0**, at **3024 × 1898**. The demo uses ordinary Markdown files in a separate `MarkFlowy Studio` workspace. `single-file.png` shows the same document with the folder closed, the sidebars hidden, and full-width writing disabled. It is the application's single-document layout, not Zen mode. The AI screenshot shows an unsent draft prompt, not a generated response.

An earlier windowed capture was replaced because removing the sharing badge left the application's reserved window-control space visible. All five views were recaptured in native full-screen mode, which uses the application's compact title-bar layout. The purple system-sharing badge is absent from these raw captures, and no region at the left edge was erased or patched.

Only the Computer Use pointer and spotlight were cleaned, using blank native title-bar and tab/toolbar pixels from the same capture. Both rectangles were visually checked in each view; no document, text, toolbar icon, file name, or editor control was generated or repainted.

| Overlay | Destination rectangle | Native source rectangle |
| --- | --- | --- |
| Pointer and spotlight, all five views | x=980, y=0, width=260, height=116 | x=2000, y=0, width=260, height=116 |

Every pixel outside this cleanup rectangle was compared with the original capture and verified unchanged. `scripts/render-screenshot-frames.mjs` preserves the native image pixels inside the rounded frame and verifies them again. The rendered website images are **3456 × 2304**; README assets are synchronized by that script.

## Previous capture — 2026-09-27

The following crops are retained as the record of the earlier capture and are **not applied to the current screenshots**.

Captured from the same MarkFlowy 0.102.0 demo window on 2026-09-27, with the pointer away from the repaired region. These are native screenshot crops, not generated UI.

| Crop | Applied to | Rectangle in the 3024 × 1898 source |
| --- | --- | --- |
| light-titlebar.png | home, sourcecode, ai | x=1100, y=0, width=220, height=80 |
| dark-tab.png | darkmode | x=590, y=40, width=200, height=94 |

The cleanup composites only these regions into the full-resolution originals. Every pixel outside the repair rectangle was checked to be unchanged, and each repaired region was checked to match its native crop exactly. The full-image ImageGen cleanup candidates were discarded; generated UI pixels are not used.
