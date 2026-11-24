# Eidos Chart Plugin

Official chart visualization plugin for Eidos Lite table views.

Version 0.4.1 requires plugin API 3.0.0, supported by Eidos Lite 0.20.0 and Eidos CLI 3.0.0 or later. PNG export and compact dashboard presentation require a host providing the corresponding capabilities, including Eidos Lite 0.22.1. In CLI Serve, install the plugin with `eidos plugin install` and add a Chart view from the table's view menu.

## Features

- **Chart types** include Column, Bar, Line, Donut, Big Number, and Calendar Heatmap.
- **Calendar Heatmap** shows daily counts or numeric aggregates in a month or week grid. Choose a date field for Group by and a timezone for date/time values. Select a populated day to open its latest record. For Average, Minimum and Maximum the color scale spans the whole range of the field (taken from a Formula whose results are literal numbers, otherwise the lowest and highest recorded value), so a day is not the darkest just because it is the best so far.
- **Grouping & Aggregation**: Count, Sum, Average, Min, and Max over all matching records. Chart uses host aggregation where available and reads matching rows in batches when the host cannot provide the requested grouping.
- **Temporal Grouping**: Group by Day, Month, or Year.
- **Offline & Self-Contained**: Powered by Chart.js in a secure, sandboxed iframe.
- **PNG Export**: Uses the host's file export capability: a native save dialog in Lite,
  or a browser download in CLI Serve. Requires a host providing `ui.exportFile`;
  older hosts show an unavailable export button. Export errors and cancellation
  are shown inline. Chart remains a read-only plugin and needs no filesystem grant.

## Development

```bash
npm ci
npm test
npm run check
npm run pack:plugin
```

## License

MIT
