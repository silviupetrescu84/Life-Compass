# Life Compass

An open-source space to explore personal values. Life Compass uses vanilla TypeScript, Vite, and a Node.js server with [built-in SQLite](https://nodejs.org/api/sqlite.html).

## Run locally

Use Node.js 22.18 or newer.

```sh
npm install
npm run dev
```

## Serve a production build

```sh
npm run build
npm start
```

The server defaults to `127.0.0.1:4173`. Set `HOST` and `PORT` to change the listening address. When serving over HTTPS through a reverse proxy, set `APP_ORIGIN` to the public origin, such as `https://compass.example.com`, to enable secure session cookies and same-origin writes.

## Contributing

Small, focused contributions are welcome. Keep the app framework-free, preserve the values data, and run `npm run check` and `npm run build` before submitting changes.

## License

MIT — see [LICENSE](LICENSE).
