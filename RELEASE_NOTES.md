## What's new

### Calendar Heatmap

Choose **Calendar Heatmap** as the chart type, then select a date or date/time field under **Group by**. The month and week grids color each day by record count or a numeric aggregate, so you can spot busy days, gaps, and weekly patterns. Choose a scale color and use Local or UTC for date/time values. Select a populated day to open its latest record.

## Bug fixes

- Charts group all matching date/time records by UTC day, month, or year.
- Count includes records with an empty Value field. Numeric aggregations handle numeric Formula results returned as strings or large integers and show a settings prompt for non-numeric fields.
- A failed load clears stale chart data and hides PNG export. Retry reloads the current chart.
