#!/usr/bin/env bash
# Prepares the web build used for the screenshots, without touching package.json:
# installs react-dom and react-native-web, and adds the Appearance.setColorScheme
# that react-native-web lacks (theme/useTheme.ts calls it).
set -euo pipefail
cd "$(dirname "$0")/../.."
npm install --no-save --no-audit --no-fund react-dom@19.2.3 react-native-web@~0.21.0
f=node_modules/react-native-web/dist/exports/Appearance/index.js
node -e '
const fs = require("fs"), f = process.argv[1], s = fs.readFileSync(f, "utf8");
if (!s.includes("setColorScheme")) fs.writeFileSync(f, s.replace("var Appearance = {", "var Appearance = {\n  setColorScheme() {},"));
' "$f"
echo "Ready: run  CI=1 npx expo start --web --port 8081"
