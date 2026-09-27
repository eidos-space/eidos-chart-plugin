# Eidos Chart Plugin

Official chart visualization plugin for Eidos Lite table views.

Version 0.2.0 requires Eidos Lite 0.19.0 or later and plugin API 2.0.0.

## Features

- **Multiple Chart Types**: Column, Bar, Line, Donut, and Big Number metrics.
- **SQLite-Accelerated Grouping & Aggregation**: Fast aggregations (Count, Sum, Average, Min, Max) calculated directly over table data.
- **Temporal Grouping**: Group by Day, Month, or Year.
- **Offline & Self-Contained**: Powered by Chart.js in a secure, sandboxed iframe.

## Development

```bash
npm ci
npm test
npm run check
npm run pack:plugin
```

## License

MIT
