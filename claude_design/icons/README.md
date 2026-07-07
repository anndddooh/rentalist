# Rentalist アイコン一式

## Web (frontend)
public/ に icons/web/ の中身と favicon.svg をコピーし、index.html の <head> に:

    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">

PWA (任意) — manifest.webmanifest:

    { "icons": [
      { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" } ] }

## iOS (Expo)
icons/ios/AppIcon-1024.png を mobile/assets/icon.png としてコピーし、app.json:

    { "expo": { "icon": "./assets/icon.png",
      "ios": { "icon": { "light": "./assets/icon.png", "dark": "./assets/icon-dark.png" } } } }

- AppIcon-1024.png … 1024x1024・不透過・角丸なし（iOSが自動でマスク）
- AppIcon-dark-1024.png … iOS 18+ のダーク外観用（任意）
