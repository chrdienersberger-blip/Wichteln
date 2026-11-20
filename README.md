# Wichtel-Rap 🎤🎁

Ein Wichtelautomat, der komplett im Browser läuft und über GitHub Pages ausgeliefert wird. Wer seinen geheimen Link öffnet, bekommt per Rap-Story mit Beat verraten, wen er beschenkt.

## So geht's

1. Teilnehmer, Budget, Bescherungsdatum und optional Ausnahmen eintragen (z. B. „Anna - Ben“ für Paare, die sich nicht gegenseitig ziehen sollen) und „Auslosen“ drücken.
2. Jede Person bekommt einen eigenen geheimen Link. „Senden“ öffnet das Teilen-Menü bzw. WhatsApp.
3. Beim Öffnen läuft ein Beat, und die Rap-Story erscheint im Takt: Nordpol, Ziehung, Mission, Enthüllung. Am Ende verraten Trommelwirbel und Konfetti, wen man beschenkt.

Der Organisator sieht die Zuordnung nicht und kann selbst mitmachen.

## Datenschutz

Es gibt keinen Server und keine Datenbank. Die Zuordnung steckt verschleiert im `#`-Teil des Links, und der wird nie an einen Server geschickt. Eine Content-Security-Policy verbietet jede Verbindung zu fremden Servern. Der Link ist nur verschleiert, nicht sicher verschlüsselt. Für Wichteln unter Freunden reicht das.

## Veröffentlichen

Settings → Pages → Branch `main`, Ordner `/ (root)`. Danach ist die Seite unter `https://chrdienersberger-blip.github.io/wichteln/` erreichbar.

Lokal testen geht ohne Build-Schritt: `python3 -m http.server 8000` und dann `http://localhost:8000` öffnen.
