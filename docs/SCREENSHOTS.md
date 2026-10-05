# Product screenshots

Captured in native macOS full-screen mode on 2026-10-05 using the locally installed `/Applications/MarkFlowy.app` (`0.103.0`). These native Tauri window captures show the local application; they do not certify a separately published package or cross-platform acceptance.

## Assets

Five cleaned native source images are retained at 3024 × 1898 in `public/screenshot-frames/originals/`. Presentation images use the same external frame and are exported at 3456 × 2304 (3:2). The screenshot remains at its original pixel size, centered at `(216, 203)`; only the outer 40 px corner radius is masked for the presentation frame. No document, text, editor control, or model response is generated or repainted. Website components scale the images responsively.

Native full-screen mode removes the title-bar space reserved for macOS window controls, and the purple system-sharing badge is absent from the raw captures. Only the Computer Use pointer and spotlight were removed, using blank native title-bar and tab/toolbar pixels from the same original capture. No cleanup was applied to the left edge. The [cleanup record and exact coordinates](../public/screenshot-frames/capture-patches/README.md) distinguish this cleanup from the retained crops for the previous capture. Every pixel outside the current cleanup rectangle was verified unchanged before the frames were regenerated.

| File | View | Used by |
| --- | --- | --- |
| `public/home.png` | Light theme, visual editor, local file tree and outline in a blue-white frame | Three-language README |
| `apps/web/public/screenshots/home.png` | Identical copy of `public/home.png` | Website hero and user guides |
| `apps/web/public/screenshots/sourcecode.png` | Light theme, Markdown source and outline | README, user guides and website feature section |
| `apps/web/public/screenshots/darkmode.png` | Dark theme, visual editor and outline in a deep-blue frame | README and user guides |
| `apps/web/public/screenshots/ai.png` | Light theme, visual editor and Chat AI sidebar | Website feature section |
| `apps/web/public/screenshots/single-file.png` | Light theme, one document with no workspace, hidden sidebars and full-width writing disabled | Homepage single-file section and user guides |
| `public/copilot.png` | Identical copy of the Chat AI screenshot | Retained legacy asset path; this depicts chat, not inline Copilot completion |

## Reproduce

1. Copy [the sample workspace](../public/screenshot-workspace) to a local folder named `MarkFlowy Studio`. This capture used `/tmp/MarkFlowy Studio`. Its four public demonstration files are `A little room to think.md`, `Writing checklist.md`, `Notes/Field notes.md`, and `Drafts/Sunday letter.md`.
2. Open that folder in a separate Desktop window. Open `A little room to think.md` and expand `Notes` and `Drafts` in the explorer.
3. Select English and the built-in MarkFlowy Light theme. Enter native macOS **full-screen mode** and scroll to the top. Wait for the system menu bar to hide, then match the 3024 × 1898 native capture size. Leave the file tree and outline visible for the workspace views.
4. Capture visual editing, then choose **More → View → Source Code** for the source image. Use the same document and window size.
5. Return to visual editing and select MarkFlowy Dark for the dark image.
6. For the AI view, return to the light theme and open Chat AI. The pictured text is an unsent example prompt; no model response was generated or fabricated. Provider and model choices depend on the local setup.
7. For the single-file view, close the folder, keep `A little room to think.md` open as the only document, hide both sidebars, and turn off full-width writing. Keep Zen mode off so the screenshot shows the normal single-document layout.
8. Confirm that the native full-screen layout is active and no system-sharing badge appears in the capture. Inspect each saved image for the pointer and spotlight before framing. Moving the pointer or waiting does not necessarily remove these Computer Use overlays. Follow the recorded pointer-cleanup coordinates only when they match the new capture; use blank native pixels from the same capture and preserve the real UI and text.
9. Restore the original appearance, language, and writing-width preferences and close the demonstration window. After this capture, Chinese, the dark theme, and full-width writing were restored. Keep private workspaces, credentials, notifications, and personal conversations outside the capture.

## Presentation frames

The frame palette follows the website's porcelain white, mist blue, and deep navy colors in `apps/web/components/site/site.css`. Light and dark decorative backgrounds were generated with the built-in ImageGen tool; the [exact prompts](../public/screenshot-frames/prompts.md) and both backgrounds are retained with the originals. A thin translucent rim and two soft shadows give depth without introducing extra window controls, labels, or perspective.

After replacing the original captures, regenerate all five presentation images and the two duplicate asset paths from the repository root:

```sh
fnm exec --using=24 node scripts/render-screenshot-frames.mjs
```

The script uses the existing Sharp installation from the website's Next.js image pipeline, without adding a dependency. It checks source dimensions and compares the interior pixels of every output with the original screenshot to catch any resampling or repainting. It produces the same files deterministically from the saved backgrounds; it does not call an image-generation API again.

If capture dimensions change, update the renderer and check the image layouts in `apps/web/components/site/Preview.tsx`, `apps/web/components/site/SingleFile.tsx`, and `apps/web/components/FeatureList.tsx`. Edit README text and image references in `README.src.md`, then regenerate the language outputs with the repository's NRG version. Existing image paths are retained so the README, guides, and website all receive the same framed assets.
