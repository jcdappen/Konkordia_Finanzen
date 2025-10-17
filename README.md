# Finanz-Dashboard mit sicherer Authentifizierung

## Projektstruktur:
```
netlify-projekt/
├── index.html                          ← Ihr Dashboard (Frontend)
├── netlify.toml                        ← Netlify Konfiguration
├── package.json                        ← Node.js Dependencies
└── netlify/
    └── functions/
        ├── login.js                    ← Login Function
        └── get-quarters.js             ← Geschützte Daten-Function
```

## Setup-Schritte:
1. ✅ Dateien erstellen
2. ⏳ Auf Netlify hochladen
3. ⏳ Umgebungsvariablen setzen
4. ⏳ Testen

## Umgebungsvariablen (in Netlify Dashboard setzen):
- DASHBOARD_PASSWORD = Ihr gewünschtes Passwort
- JWT_SECRET = Ein langer zufälliger String
- DATABASE_URL = Ihre Datenbank-URL (falls vorhanden)
