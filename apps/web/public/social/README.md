# Social sharing cards

The English and Chinese PNG cards are 1200 × 630 pixels. They use the website's
white, navy, blue, cyan and violet palette, its handwritten Flowy wordmark, and
the original ribbon geometry. The headline follows the localized homepage copy.

Regenerate from the repository root with:

```sh
fnm exec --using=24 node scripts/render-social-cards.mjs
```

The editable copy and layout live in `scripts/render-social-cards.mjs`. The
generator reuses the installed Sharp dependency and the bundled, OFL-licensed
Inter variable font. It reads the existing `BrandWordmark.tsx` and `Ribbon.tsx`
vector paths directly. It does not run the application or a build.

Chinese text uses PingFang SC on macOS, matching the website. On another system,
install a suitable Chinese font and set `MF_SOCIAL_CJK_FONT`, for example:

```sh
MF_SOCIAL_CJK_FONT='Noto Sans CJK SC' node scripts/render-social-cards.mjs
```

Font substitution can change glyph metrics; visually inspect both cards after
regeneration. The committed PNG files need no fonts, JavaScript or external
requests when social platforms fetch them. Sharp's SVG and text rendering are
documented in its [constructor reference](https://sharp.pixelplumbing.com/api-constructor/).
