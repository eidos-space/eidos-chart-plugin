# Eidos Chart Plugin

Official chart visualization plugin for Eidos Lite table views.

Version 0.3.2 requires plugin API 3.0.0, supported by Eidos Lite 0.20.0 and Eidos CLI 3.0.0 or later. PNG export and compact dashboard presentation require a host providing the corresponding capabilities, including Eidos Lite 0.22.1. In CLI Serve, install the plugin with `eidos plugin install` and add a Chart view from the table's view menu.

## Features

- **Multiple Chart Types**: Column, Bar, Line, Donut, and Big Number metrics.
- **SQLite-Accelerated Grouping & Aggregation**: Fast aggregations (Count, Sum, Average, Min, Max) calculated directly over table data.
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
