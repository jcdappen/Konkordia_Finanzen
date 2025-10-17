const jwt = require('jsonwebtoken');

// Hilfsfunktion: Token validieren
function validateToken(authHeader, jwtSecret) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Kein Token gefunden' };
  }

  const token = authHeader.substring(7); // "Bearer " entfernen

  try {
    const decoded = jwt.verify(token, jwtSecret);
    return { valid: true, decoded };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token abgelaufen' };
    }
    return { valid: false, error: 'Ungültiger Token' };
  }
}

exports.handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // OPTIONS Request für CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Nur GET-Requests erlauben
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('JWT_SECRET not set!');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Token validieren
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const validation = validateToken(authHeader, jwtSecret);

    if (!validation.valid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          error: 'Unauthorized',
          message: validation.error
        })
      };
    }

    // Token ist gültig! Jetzt Daten holen
    const jahr = event.queryStringParameters?.jahr || '2025';

    // DATABASE_URL prüfen
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error('DATABASE_URL not set!');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Datenbank nicht konfiguriert',
          details: 'DATABASE_URL Umgebungsvariable fehlt in Netlify'
        })
      };
    }

    // PostgreSQL Connection
    const { Pool } = require('pg');
    const pool = new Pool({ 
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    });

    try {
      // Quartale mit allen Daten laden (JOIN mit einnahmen_kategorien und ausgaben_kategorien)
      const quartaleResult = await pool.query(`
        SELECT 
          q.id,
          q.jahr,
          q.quartal,
          q.period_start,
          q.period_end,
          q.ueberschuss,
          q.kontostand_aktuell,
          q.kontostand_vorjahr,
          e.spenden_aktuell,
          e.spenden_vorjahr,
          e.mission_aktuell as mission_einnahmen_aktuell,
          e.mission_vorjahr as mission_einnahmen_vorjahr,
          e.sonstige_aktuell as sonstige_einnahmen_aktuell,
          e.sonstige_vorjahr as sonstige_einnahmen_vorjahr,
          e.gesamt_aktuell as gesamt_einnahmen_aktuell,
          e.gesamt_vorjahr as gesamt_einnahmen_vorjahr,
          a.gebaeude_aktuell,
          a.gebaeude_vorjahr,
          a.personal_aktuell,
          a.personal_vorjahr,
          a.mission_aktuell as mission_ausgaben_aktuell,
          a.mission_vorjahr as mission_ausgaben_vorjahr,
          a.sonstige_aktuell as sonstige_ausgaben_aktuell,
          a.sonstige_vorjahr as sonstige_ausgaben_vorjahr,
          a.gesamt_aktuell as gesamt_ausgaben_aktuell,
          a.gesamt_vorjahr as gesamt_ausgaben_vorjahr
        FROM quartale q
        LEFT JOIN einnahmen_kategorien e ON q.id = e.quartal_id
        LEFT JOIN ausgaben_kategorien a ON q.id = a.quartal_id
        WHERE q.jahr = $1
        ORDER BY q.quartal
      `, [jahr]);

      const quartale = quartaleResult.rows.map(row => ({
        quartal: row.quartal,
        jahr: row.jahr,
        period_start: row.period_start,
        period_end: row.period_end,
        ueberschuss: row.ueberschuss,
        kontostand_aktuell: row.kontostand_aktuell,
        kontostand_vorjahr: row.kontostand_vorjahr,
        spenden_aktuell: row.spenden_aktuell || 0,
        spenden_vorjahr: row.spenden_vorjahr || 0,
        mission_einnahmen_aktuell: row.mission_einnahmen_aktuell || 0,
        mission_einnahmen_vorjahr: row.mission_einnahmen_vorjahr || 0,
        sonstige_einnahmen_aktuell: row.sonstige_einnahmen_aktuell || 0,
        sonstige_einnahmen_vorjahr: row.sonstige_einnahmen_vorjahr || 0,
        gesamt_einnahmen_aktuell: row.gesamt_einnahmen_aktuell || 0,
        gesamt_einnahmen_vorjahr: row.gesamt_einnahmen_vorjahr || 0,
        gebaeude_aktuell: row.gebaeude_aktuell || 0,
        gebaeude_vorjahr: row.gebaeude_vorjahr || 0,
        personal_aktuell: row.personal_aktuell || 0,
        personal_vorjahr: row.personal_vorjahr || 0,
        mission_ausgaben_aktuell: row.mission_ausgaben_aktuell || 0,
        mission_ausgaben_vorjahr: row.mission_ausgaben_vorjahr || 0,
        sonstige_ausgaben_aktuell: row.sonstige_ausgaben_aktuell || 0,
        sonstige_ausgaben_vorjahr: row.sonstige_ausgaben_vorjahr || 0,
        gesamt_ausgaben_aktuell: row.gesamt_ausgaben_aktuell || 0,
        gesamt_ausgaben_vorjahr: row.gesamt_ausgaben_vorjahr || 0
      }));

      // Quartalsziele laden
      const zieleResult = await pool.query(`
        SELECT quartalsbedarf, visionsbetrag
        FROM quartalsziele
        WHERE jahr = $1
        LIMIT 1
      `, [jahr]);

      const quartalsziele = zieleResult.rows.length > 0 
        ? zieleResult.rows[0]
        : { quartalsbedarf: 75000, visionsbetrag: 81000 };

      // Jahresübersicht laden
      const jahresResult = await pool.query(`
        SELECT gesamteinnahmen, gesamtausgaben, kumuliertes_ergebnis
        FROM jahresuebersicht
        WHERE jahr = $1
        LIMIT 1
      `, [jahr]);

      let jahresuebersicht;
      
      if (jahresResult.rows.length > 0) {
        jahresuebersicht = jahresResult.rows[0];
      } else {
        // Falls keine Jahresübersicht existiert, aus Quartalen berechnen
        let kumuliertes_ergebnis = 0;
        let gesamteinnahmen = 0;
        let gesamtausgaben = 0;

        quartale.forEach(q => {
          kumuliertes_ergebnis += parseFloat(q.ueberschuss || 0);
          gesamteinnahmen += parseFloat(q.gesamt_einnahmen_aktuell || 0);
          gesamtausgaben += parseFloat(q.gesamt_ausgaben_aktuell || 0);
        });

        jahresuebersicht = {
          kumuliertes_ergebnis,
          gesamteinnahmen,
          gesamtausgaben
        };
      }

      await pool.end();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          quartale,
          quartalsziele,
          jahresuebersicht
        })
      };

    } catch (dbError) {
      console.error('Database error:', dbError);
      await pool.end();
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Datenbankfehler',
          details: dbError.message
        })
      };
    }

  } catch (error) {
    console.error('Error in get-quarters:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Ein Fehler ist aufgetreten',
        details: error.message 
      })
    };
  }
};
