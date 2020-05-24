# LED3D
## Getting Started

1. Run `npm install` to get all the required node packages.
2. Run `npm run dev|prod` for dev or production mode (leave this running for the watch).
3. In parallel, run `npm start` to run `server.js`.
4. Navigate to `http://locahost:4000` and have fun!

## Modes
### Development
Runs webpack with --watch to watch for any changes to the `src` files automatically re-bundle `main.js` and refresh the browser!

### Production
Runs webpack with `optimize` set to minify `main.js`