# Life Compass

An open-source, browser-only space to explore personal values. Built with Vite, vanilla TypeScript, HTML, and CSS. No backend, authentication, analytics, or external APIs.

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm install
npm run dev
```

```sh
npm run build
npm run preview
```

The build runs strict TypeScript checking before producing the static application in `dist/`.

Values and categories retain their original order and wording. Cards are native toggle buttons supporting Tab, Enter, and Space, with `aria-pressed` states and a live selection count.

Explore with unlimited selections, case-insensitive name and description search, and one category filter at a time. Search and category filters work together and remain in place when returning from review. Review lets you remove values and continue once between 1 and 6 remain. Continue shows a simple core-values summary with an option to edit; no compass visualization is implemented yet.

Selected value IDs are saved to `localStorage` under `life-compass.selected-value-ids` and restored on reload. Invalid or outdated IDs are ignored. When storage is unavailable, the app still works in memory and displays a notice. Search and category filters are preserved during in-app navigation but reset on reload. Nothing is sent to a server.

## Contributing

Small, focused contributions are welcome. Keep the app framework-free, preserve the values data, and run `npm run build` before submitting changes. For UI changes, check keyboard navigation and narrow and wide screens.

## License

MIT — see [LICENSE](LICENSE).
