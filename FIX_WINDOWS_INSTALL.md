# Windows install fix

The original package used `better-sqlite3`, which is a native dependency. On Windows, native dependencies can fall back to `node-gyp` and require Visual Studio C++ Build Tools when no prebuilt binary exists for your Node version.

This updated version removes `better-sqlite3` and stores scores in a simple JSON file locally, or temporary server memory on Vercel, so `npm install` should not need Visual Studio Build Tools.

## Clean the old failed install

From PowerShell inside the `wedding-games-app` folder:

```powershell
# stop any running Node/Next processes first
Remove-Item -Recurse -Force .\node_modules -ErrorAction SilentlyContinue
Remove-Item -Force .\package-lock.json -ErrorAction SilentlyContinue
npm cache verify
npm install
npm run dev
```

Open:

```txt
http://localhost:3097
```

## If Windows says files are locked

Close VS Code terminals, stop any `node.exe` processes from Task Manager, then run the cleanup commands again.
