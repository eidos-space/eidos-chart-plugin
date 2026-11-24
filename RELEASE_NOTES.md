## Calendar Heatmap improvements

- Average, Minimum, and Maximum use the value field's range for the color scale. Simple CASE formulas with numeric results contribute their possible bounds, so a mood score of 1 can stay lighter than the maximum of 2 even before anyone records a 2.
- The cells and legend use the same color curve. Midrange values stay lighter, making it easier to spot days near the top of the scale.

Thanks to @davi-jorge-art for [PR #6](https://github.com/eidos-space/eidos-chart-plugin/pull/6).
