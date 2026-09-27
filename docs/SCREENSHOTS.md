# Product screenshots

Captured on macOS on 2026-09-27 using the locally installed MarkFlowy Desktop app (`0.102.0`, V1 preparation). These are native Tauri window captures, not browser mockups. They illustrate the current interface; they do not certify a published V1 package or cross-platform acceptance.

## Assets

Cursor-cleaned native source images are retained at 3024 × 1898 in `public/screenshot-frames/originals/`. Presentation images add an external frame and are exported at 3456 × 2304 (3:2). The screenshot remains at its original pixel size, centered at `(216, 203)`; only the outer 20 px corner radius is masked. No UI, text, or model response is generated or repainted. Website components declare the presentation dimensions and scale the images responsively.

The capture tool included a pointer overlay. Only the affected regions were replaced with clean native crops taken from the same demo window with the pointer elsewhere: an empty title-bar region for the three light views, and the real `Welcome.md` tab label for the dark view. The [native repair crops and coordinates](../public/screenshot-frames/capture-patches/README.md) are retained. Every pixel outside those regions was verified unchanged before the frames were regenerated.

| File | View | Used by |
| --- | --- | --- |
| `public/home.png` | Light theme, visual editor, local file tree and outline in a blue-white frame | Three-language README |
| `apps/web/public/screenshots/home.png` | Identical copy of `public/home.png` | Website hero and user guides |
| `apps/web/public/screenshots/sourcecode.png` | Light theme, Markdown source and outline | README, user guides and website feature section |
| `apps/web/public/screenshots/darkmode.png` | Dark theme, visual editor and outline in a deep-blue frame | README and user guides |
| `apps/web/public/screenshots/ai.png` | Light theme, visual editor and Chat AI sidebar | Website feature section |
| `public/copilot.png` | Identical copy of the Chat AI screenshot | Retained legacy asset path; this depicts chat, not inline Copilot completion |

## Reproduce

1. Copy [the sample workspace](../public/screenshot-workspace) to a local folder named `MarkFlowy`. It contains only public demonstration text written for these captures.
2. Open that folder in a separate Desktop window. Open `Welcome.md` and expand the three folders in the explorer.
3. Select English and the built-in MarkFlowy Light theme, use full screen with app scaling at 1, and scroll to the top. Leave the file tree and outline visible; give each sidebar about one fifth of the window width.
4. Capture visual editing, then choose **More → View → Source Code** for the source image. Use the same document and window size.
5. Return to visual editing and select MarkFlowy Dark for the dark image.
6. For the AI view, return to the light theme and open Chat AI. The pictured text is an unsent example prompt; no model response was generated or fabricated. Provider and model choices depend on the local setup.
7. Inspect each saved image for the pointer and its halo before framing. Moving the pointer or waiting does not necessarily remove the capture tool's overlay. If necessary, take another native capture with the pointer elsewhere and composite only the affected region; preserve the real UI and text.
8. Restore the original appearance and language preferences after capturing. Keep private workspaces, credentials, notifications, and personal conversations outside the capture.

## Presentation frames

The frame palette follows the website's porcelain white, mist blue, and deep navy colors in `apps/web/components/site/site.css`. Light and dark decorative backgrounds were generated with the built-in ImageGen tool; the [exact prompts](../public/screenshot-frames/prompts.md) and both backgrounds are retained with the originals. A thin translucent rim and two soft shadows give depth without introducing extra window controls, labels, or perspective.

After replacing the original captures, regenerate all four presentation images and the two duplicate asset paths from the repository root:

```sh
fnm exec --using=24 node scripts/render-screenshot-frames.mjs
```

The script uses the existing Sharp installation from the website's Next.js image pipeline, without adding a dependency. It checks source dimensions and compares the interior pixels of every output with the original screenshot to catch any resampling or repainting. It produces the same files deterministically from the saved backgrounds; it does not call an image-generation API again.

If capture dimensions change, update the renderer and `apps/web/components/site/Preview.tsx` / `apps/web/components/FeatureList.tsx`. Edit README text and image references in `README.src.md`, then regenerate the language outputs with the repository's NRG version. Existing image paths are retained so the README, guides, and website all receive the same framed assets.
