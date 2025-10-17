# 📦 Installation und Deployment Anleitung

## Schritt 1: Projekt auf Netlify hochladen

### Option A: Über Git (Empfohlen)
1. Erstellen Sie ein neues Git-Repository (z.B. auf GitHub)
2. Laden Sie alle Dateien aus dem `netlify-projekt` Ordner hoch
3. Verbinden Sie das Repository mit Netlify:
   - Gehen Sie zu https://app.netlify.com
   - Klicken Sie auf "Add new site" → "Import an existing project"
   - Wählen Sie Ihr Git-Repository aus
   - Netlify erkennt automatisch die `netlify.toml` Konfiguration
   - Klicken Sie auf "Deploy site"

### Option B: Drag & Drop
1. Gehen Sie zu https://app.netlify.com
2. Ziehen Sie den kompletten `netlify-projekt` Ordner auf die Netlify-Oberfläche
3. Warten Sie auf das Deployment

## Schritt 2: Umgebungsvariablen setzen ⚠️ WICHTIG!

Nach dem Deployment **müssen** Sie die Umgebungsvariablen setzen:

1. Gehen Sie zu Ihrem Site-Dashboard auf Netlify
2. Klicken Sie auf **Site settings** → **Environment variables**
3. Fügen Sie folgende Variablen hinzu:

### DASHBOARD_PASSWORD
- **Key:** `DASHBOARD_PASSWORD`
- **Value:** Ihr gewünschtes Passwort (z.B. `MeinSuperSicheresPasswort123!@#`)
- **Scopes:** Alle Scopes auswählen

### JWT_SECRET
- **Key:** `JWT_SECRET`
- **Value:** Ein langer zufälliger String (min. 32 Zeichen)
- **Beispiel:** `a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8`
- **Scopes:** Alle Scopes auswählen

💡 **Tipp:** Generieren Sie einen sicheren JWT_SECRET hier: https://www.uuidgenerator.net/

### DATABASE_URL (Optional, für später)
Wenn Sie Ihre echte Datenbank anbinden möchten:
- **Key:** `DATABASE_URL`
- **Value:** Ihre PostgreSQL Verbindungsstring
- **Beispiel:** `postgresql://user:password@host:5432/database`

## Schritt 3: Redeploy auslösen

Nach dem Setzen der Umgebungsvariablen:
1. Gehen Sie zu **Deploys** → **Trigger deploy** → **Deploy site**
2. Warten Sie, bis das Deployment abgeschlossen ist (ca. 1-2 Minuten)

## Schritt 4: Testen

1. Öffnen Sie Ihre Netlify-URL (z.B. `https://ihr-projekt.netlify.app`)
2. Sie sollten den Login-Screen sehen
3. Geben Sie das Passwort ein, das Sie als `DASHBOARD_PASSWORD` gesetzt haben
4. Nach erfolgreichem Login sollten Sie das Dashboard sehen

## ⚠️ Wichtige Hinweise

### Sicherheit
- ✅ Passwörter sind **nicht** im Code sichtbar
- ✅ Tokens laufen nach 24 Stunden ab
- ✅ API-Endpoints sind durch Token-Validierung geschützt
- ⚠️ Teilen Sie niemals Ihre `JWT_SECRET` oder `DASHBOARD_PASSWORD`

### Troubleshooting

**Problem: "Server configuration error"**
- Lösung: Umgebungsvariablen fehlen → siehe Schritt 2

**Problem: "Falsches Passwort" obwohl Passwort korrekt**
- Lösung: Nach dem Setzen der Environment Variables muss ein Redeploy durchgeführt werden

**Problem: "Token abgelaufen"**
- Lösung: Normal! Melden Sie sich einfach erneut an. Token sind 24h gültig.

**Problem: Functions werden nicht gefunden (404)**
- Lösung: Prüfen Sie, ob die Ordnerstruktur korrekt ist:
  ```
  netlify/
  └── functions/
      ├── login.js
      └── get-quarters.js
  ```

### Logs anschauen

Bei Problemen können Sie die Function-Logs einsehen:
1. Netlify Dashboard → **Functions**
2. Klicken Sie auf eine Function (z.B. `login`)
3. Sehen Sie sich die **Logs** an

## Nächste Schritte

### Echte Datenbank anbinden

Aktuell verwendet `get-quarters.js` Mock-Daten. Um Ihre echte Datenbank anzubinden:

1. Installieren Sie den PostgreSQL-Client:
   ```json
   // In package.json hinzufügen:
   "dependencies": {
     "jsonwebtoken": "^9.0.2",
     "pg": "^8.11.3"
   }
   ```

2. Ersetzen Sie in `get-quarters.js` den Mock-Daten-Teil:
   ```javascript
   // Statt mockData:
   const { Pool } = require('pg');
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     ssl: { rejectUnauthorized: false }
   });

   const result = await pool.query(`
     SELECT * FROM quartale WHERE jahr = $1
   `, [jahr]);
   
   const quartale = result.rows;
   ```

3. Setzen Sie die `DATABASE_URL` Umgebungsvariable
4. Redeploy durchführen

### Custom Domain einrichten

1. Netlify Dashboard → **Domain management**
2. Klicken Sie auf **Add custom domain**
3. Folgen Sie den Anweisungen zum DNS-Setup

## 🎉 Fertig!

Ihr Dashboard ist jetzt sicher geschützt mit:
- ✅ Backend-Authentifizierung
- ✅ JWT-Tokens
- ✅ Automatischem Token-Ablauf
- ✅ Geschützten API-Endpoints
- ✅ Admin-Seite zum Eingeben der Quartalsdaten

## 📝 Admin-Seite verwenden

Die Admin-Seite ist unter `/admin.html` erreichbar.

**Zugriff:**
1. Gehen Sie zu: `https://ihre-domain.netlify.app/admin.html`
2. Melden Sie sich mit dem gleichen Passwort wie im Dashboard an
3. Geben Sie Quartalsdaten ein
4. Klicken Sie auf "Quartalsdaten speichern"

**Features der Admin-Seite:**
- ✅ Automatische Berechnungen (Gesamtsummen, Überschuss)
- ✅ Eingabe für aktuelles Jahr und Vorjahr
- ✅ Quartalsziele konfigurierbar
- ✅ Spenderverhalten-Prozentsätze
- ✅ Link zurück zum Dashboard
- ✅ Sichere Authentifizierung (gleicher Token wie Dashboard)

Bei Fragen oder Problemen: Überprüfen Sie die Netlify Function Logs!
