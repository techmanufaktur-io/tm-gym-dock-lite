# Push Notifications

Web Push für die installierte PWA, mit Admin-Broadcasts und einem Opt-in-basierten "Presence-Push" zur Förderung von Co-Workouts.

## 1. Anwendungsfälle

| # | Use-Case | Auslöser | Empfänger |
|---|---|---|---|
| A | Admin-Broadcast Gym | manuell (Admin) | alle User eines Gyms |
| B | Admin-Broadcast Firma | manuell (Admin) | alle User einer Firma |
| C | Admin-Broadcast Single | manuell (Admin) | ein User |
| D | Presence-Broadcast | Check-in eines Users | alle Empfangs-Opt-in-User **desselben Gyms** |

## 2. Opt-in Modell (Presence)

Zwei unabhängige Flags pro User-Profil, beide **default OFF**, jederzeit in den Einstellungen umschaltbar:

- `broadcastPresence` — "Andere dürfen erfahren, wenn ich einchecke"
- `receivePresence` — "Ich möchte benachrichtigt werden, wenn andere einchecken"

Push wird nur ausgelöst, wenn:
`Sender.broadcastPresence === true` **UND** `Empfänger.receivePresence === true` **UND** beide im selben Gym.

Browser-Notification-Permission wird **erst** angefragt, wenn der User mindestens einen der beiden Haken setzt — kein Permission-Spam beim ersten Öffnen.

**Cooldown**: keiner. Jeder Check-in löst einen Push aus, auch wenn jemand mehrfach am Tag eincheckt.

## 3. Architektur: OneSignal

Web Push erfordert VAPID-JWT-Signaturen (ECDSA P-256) und Payload-Verschlüsselung — beides in Apps Script nicht nativ möglich. Daher Push-Provider:

**OneSignal** als Push-Provider, weil:
- Free Tier: unbegrenzte Web-Push-Subscriber & unbegrenzte Notifications
- Provider übernimmt VAPID, Encryption, Endpoint-Verwaltung, iOS/Android/Desktop-Kompatibilität
- Apps Script ruft nur eine simple REST-API per `UrlFetchApp` auf
- Targeting via "Tags" (gym, company, opt-in-Flags) — kein eigenes Subscriber-Sheet nötig
- Kein eigener Server, kein Cron, keine Crypto-Frickelei

**Trade-off**: US-Drittanbieter, Endpoints liegen extern. Akzeptabel für MVP, in Datenschutzhinweis transparent machen.

## 4. Datenmodell

### OneSignal Tags (pro Subscriber)

| Tag | Beispielwert | Zweck |
|---|---|---|
| `userId` | `daniel.pudelko@savvytec.de` | Single-Targeting |
| `gym` | `savvyGYM` | Gym-Targeting + Presence-Filter |
| `company` | `savvytec` | Firma-Targeting |
| `broadcastPresence` | `"true"` / `"false"` | Wird geloggt, aber nicht für Targeting genutzt (Filter passiert bei Sender-Trigger) |
| `receivePresence` | `"true"` / `"false"` | Filter für Presence-Push-Empfänger |

### Sheet (zusätzliche Spalten in Users-Tab)

| Spalte | Zweck |
|---|---|
| `oneSignalPlayerId` | Verknüpfung User ↔ OneSignal-Subscriber |
| `broadcastPresence` | Quelle of truth für Sender-Filter |
| `receivePresence` | Redundant zum Tag, aber für Apps-Script-Logik praktisch |
| `pushConsentTs` | DSGVO-Nachweis |

## 5. Frontend (`index.html` + `sw.js`)

### Integration
- OneSignal Web SDK via `<script>` einbinden (kein eigener Service Worker für Push nötig — OneSignal bringt seinen eigenen mit, der mit dem savvyGYM-SW koexistieren muss → `OneSignalSDKWorker.js` separat ablegen)
- App-ID & Safari-Web-ID aus OneSignal-Dashboard hardcoden

### UI-Änderungen
- **Settings-Screen**: zwei Toggles (`broadcastPresence`, `receivePresence`), Permission-Status, "Push deaktivieren"-Button
- **Erstes Aktivieren eines Toggles** → Permission-Prompt → bei Erfolg: OneSignal-`login(userId)` + Tags setzen + Sheet-Update
- **Toggle ändern** → Tag updaten + Sheet-Update

### Check-in-Hook
Nach erfolgreichem Check-in zusätzlich `POST` an Apps Script mit `{ action: 'notifyPresence', userId, gym }`. Apps Script entscheidet, ob & an wen gepushed wird.

## 6. Backend (Apps Script)

### Neue Endpoints
- `subscribePush` — speichert `oneSignalPlayerId` + Flags in Sheet
- `updatePushFlags` — togglt die Opt-ins, setzt OneSignal-Tags
- `notifyPresence` — wird vom Check-in getriggert; prüft `broadcastPresence` des Senders, sendet OneSignal-Notification mit Filter `gym = X AND receivePresence = "true" AND userId != Sender`
- `broadcast` — Admin-Endpoint für manuelle Broadcasts (A/B/C)

### OneSignal REST-Call (Pseudocode)
```js
UrlFetchApp.fetch('https://api.onesignal.com/notifications', {
  method: 'post',
  headers: { Authorization: 'Key ' + ONESIGNAL_REST_API_KEY },
  contentType: 'application/json',
  payload: JSON.stringify({
    app_id: ONESIGNAL_APP_ID,
    headings: { en: '💪 Co-Workout?' },
    contents: { en: `${vorname} ist gerade in ${gym} eingecheckt — Lust auf Co-Workout?` },
    filters: [
      { field: 'tag', key: 'gym', relation: '=', value: gym },
      { operator: 'AND' },
      { field: 'tag', key: 'receivePresence', relation: '=', value: 'true' },
      { operator: 'AND' },
      { field: 'tag', key: 'userId', relation: '!=', value: senderUserId }
    ]
  })
});
```

### Secrets
`ONESIGNAL_APP_ID` & `ONESIGNAL_REST_API_KEY` in `PropertiesService.getScriptProperties()` — niemals im Frontend.

## 7. Admin UI: Light (Custom Menu im Sheet)

`onOpen()` legt ein Menü "📢 Push" an mit:
- "Broadcast an Gym…" → `prompt` für Gym-Auswahl, Titel, Body
- "Broadcast an Firma…" → analog
- "Broadcast an User…" → analog mit Email
- "Broadcast an alle…" → mit Bestätigungsdialog

Kein Auth nötig — wer Schreibzugriff aufs Sheet hat, ist Admin.

## 8. iOS-Hinweis

Web Push auf iOS funktioniert **nur ab 16.4 + nur als zum Home-Bildschirm hinzugefügte PWA**.

Im Settings-Screen:
- iOS-Standalone erkennen via `window.navigator.standalone === true`
- Wenn iOS Safari ohne Standalone → Hinweisbox "Bitte zuerst zum Home-Bildschirm hinzufügen, um Push-Benachrichtigungen zu aktivieren"

## 9. Datenschutz / DSGVO

- Klartext-Hinweis im UI bei beiden Toggles:
  > *"Wenn du den Haken setzt, erfahren andere User dieses Gyms deinen Vornamen und die Uhrzeit deines Check-ins. Push-Versand erfolgt über den US-Anbieter OneSignal."*
- Consent-Zeitstempel im Sheet (`pushConsentTs`)
- Push-Inhalt: nur **Vorname** (nicht voller Name, nicht Firma) — minimiert Datenweitergabe
- Easy Revoke: Toggle aus → Sheet-Flag aktualisieren + OneSignal-Tag auf `"false"`
- "Push komplett deaktivieren"-Button → OneSignal `logout()` + Sheet `oneSignalPlayerId` leeren

## 10. Implementierungsschritte

1. OneSignal-Account anlegen, Web-App konfigurieren, Safari-Web-ID generieren
2. `OneSignalSDKWorker.js` ins Repo-Root legen (Coexistenz mit `sw.js` testen)
3. Sheet-Spalten ergänzen
4. Apps Script: 4 neue Endpoints + ScriptProperties
5. `index.html`: Settings-Screen erweitern, OneSignal-SDK einbinden, Toggle-Logik
6. Check-in-Funktion um `notifyPresence`-Call ergänzen
7. Custom Menu im Sheet
8. iOS-Hinweisbox
9. Datenschutzhinweise
10. **SW-Cache-Version bumpen** (`savvygym-v5`)

## 11. Beispiel-Notification (Presence)

> 💪 **Co-Workout?**
> Daniel ist gerade in savvyGYM eingecheckt — Lust auf Co-Workout?
