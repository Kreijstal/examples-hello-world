---
title: "MathML Test"
slug: "mathml-test"
updated_at: "2026-03-28T12:00:00Z"
latest_revision: "2026-03-28T12-00-00Z"
---

This page tests MathML rendering with different font variants.

## Inline math

The quadratic formula: <math><mi>x</mi><mo>=</mo><mfrac><mrow><mo>-</mo><mi>b</mi><mo>&pm;</mo><msqrt><mrow><msup><mi>b</mi><mn>2</mn></msup><mo>-</mo><mn>4</mn><mi>a</mi><mi>c</mi></mrow></msqrt></mrow><mrow><mn>2</mn><mi>a</mi></mrow></mfrac></math> is well known.

## mathvariant examples

**Normal:** <math><mi mathvariant="normal">x</mi><mo>+</mo><mi mathvariant="normal">y</mi></math>

**Bold:** <math><mi mathvariant="bold">x</mi><mo>+</mo><mi mathvariant="bold">y</mi></math>

**Italic (default for single-char mi):** <math><mi>x</mi><mo>+</mo><mi>y</mi></math>

**Bold-italic:** <math><mi mathvariant="bold-italic">x</mi><mo>+</mo><mi mathvariant="bold-italic">y</mi></math>

**Double-struck (blackboard bold):** <math><mi mathvariant="double-struck">R</mi><mo>,</mo><mi mathvariant="double-struck">Z</mi><mo>,</mo><mi mathvariant="double-struck">N</mi><mo>,</mo><mi mathvariant="double-struck">C</mi></math>

**Fraktur:** <math><mi mathvariant="fraktur">A</mi><mo>,</mo><mi mathvariant="fraktur">B</mi><mo>,</mo><mi mathvariant="fraktur">g</mi></math>

**Bold fraktur:** <math><mi mathvariant="bold-fraktur">A</mi><mo>,</mo><mi mathvariant="bold-fraktur">B</mi></math>

**Script (calligraphic):** <math><mi mathvariant="script">L</mi><mo>,</mo><mi mathvariant="script">F</mi><mo>,</mo><mi mathvariant="script">H</mi></math>

**Bold script:** <math><mi mathvariant="bold-script">L</mi><mo>,</mo><mi mathvariant="bold-script">F</mi></math>

**Sans-serif:** <math><mi mathvariant="sans-serif">x</mi><mo>+</mo><mi mathvariant="sans-serif">y</mi></math>

**Sans-serif bold:** <math><mi mathvariant="sans-serif-bold-italic">x</mi><mo>+</mo><mi mathvariant="sans-serif-bold-italic">y</mi></math>

**Monospace:** <math><mi mathvariant="monospace">x</mi><mo>+</mo><mi mathvariant="monospace">y</mi></math>

## Block display

<math display="block">
  <mrow>
    <mi mathvariant="script">L</mi>
    <mo>=</mo>
    <mfrac><mn>1</mn><mn>2</mn></mfrac>
    <msub><mi>g</mi><mrow><mi>&mu;</mi><mi>&nu;</mi></mrow></msub>
    <msup><mover><mi>x</mi><mo>.</mo></mover><mi>&mu;</mi></msup>
    <msup><mover><mi>x</mi><mo>.</mo></mover><mi>&nu;</mi></msup>
  </mrow>
</math>

## Mixed fonts in one expression

<math display="block">
  <mrow>
    <mi mathvariant="bold">v</mi>
    <mo>&isin;</mo>
    <msup><mi mathvariant="double-struck">R</mi><mi>n</mi></msup>
    <mo>,</mo>
    <mspace width="1em"/>
    <mi mathvariant="fraktur">g</mi>
    <mo>=</mo>
    <mi>Lie</mi><mo>(</mo><mi mathvariant="bold">G</mi><mo>)</mo>
  </mrow>
</math>

## CSS styled math

<math style="font-family: Georgia, serif; font-size: 1.2em;">
  <mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup>
</math>

vs.

<math style="font-family: 'Courier New', monospace; font-size: 1.2em;">
  <mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup>
</math>

vs.

<math style="font-family: Arial, sans-serif; font-size: 1.2em;">
  <mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup>
</math>
