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

## Structure

- `src/app/`: application entry point and page shell
- `src/features/values/`: value types, JSON data adapter, selection state, and screen
- `src/shared/components/`: reusable accessible selection card
- `src/shared/styles/`: responsive global styles
- `life_compass_intrinsic_values.json`: original source of all values and categories

Values and categories retain their original order and wording. Cards are native toggle buttons supporting Tab, Enter, and Space, with `aria-pressed` states and a live selection count. Select up to 6 values; click again to deselect and make room for another. At the limit, unselected cards are marked `aria-disabled` and remain keyboard discoverable. Selection lives in application memory and resets when the page reloads. Nothing is sent to a server.

## Contributing

Small, focused contributions are welcome. Keep the app framework-free, preserve the values data, and run `npm run build` before submitting changes. For UI changes, check keyboard navigation and narrow and wide screens.

## License

MIT — see [LICENSE](LICENSE).
