export const buildModelSheetTemplatePrompt = (prompt: string) => `${prompt}

Use the provided model sheet template image as the exact layout reference.
The template is a 5x5 grid. Each animation frame must be drawn only inside the lighter green square area of its cell.
Every one of the 25 frames must show a distinct animation pose or timing step. Do not duplicate the same pose across frames, do not make a static contact sheet, and do not only change position while keeping the body/object shape identical.
The pose progression must read clearly from left to right, top to bottom, like animation frames in sequence.
Do not let any part of the character, object, outline, shadow, particles, glow, weapon, cloth, or effects cross outside the lighter square area.
The template colors are locked guide colors. Preserve the exact dark green and light green template colors wherever there is no sprite art.
Do not repaint, shade, blur, antialias, compress, blend, darken, lighten, hue-shift, texture, shadow, glow, outline, or add particles over either green template color.
Leave every empty template pixel as the original flat solid color from the reference image.
Keep the dark green template color and the light green template color unchanged wherever there is no sprite art, because they will be removed after generation.
Do not use either template green color in the sprite itself.`;
