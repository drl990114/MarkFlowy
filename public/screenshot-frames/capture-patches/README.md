# Native cursor cleanup regions

Captured from the same MarkFlowy 0.102.0 demo window on 2026-09-27, with the pointer away from the repaired region. These are native screenshot crops, not generated UI.

| Crop | Applied to | Rectangle in the 3024 × 1898 source |
| --- | --- | --- |
| light-titlebar.png | home, sourcecode, ai | x=1100, y=0, width=220, height=80 |
| dark-tab.png | darkmode | x=590, y=40, width=200, height=94 |

The cleanup composites only these regions into the full-resolution originals. Every pixel outside the repair rectangle was checked to be unchanged, and each repaired region was checked to match its native crop exactly. The full-image ImageGen cleanup candidates were discarded; generated UI pixels are not used.
