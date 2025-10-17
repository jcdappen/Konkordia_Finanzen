const jwt = require('jsonwebtoken');

// Hilfsfunktion: Token validieren
function validateToken(authHeader, jwtSecret) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Kein Token gefunden' };
  }

  const token = authHeader.substring(7);

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // OPTIONS Request für CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Nur POST-Requests erlauben
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    const adminPassword = process.env.ADMIN_PASSWORD;

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

    // Daten aus Request Body holen
    const data = JSON.parse(event.body);

    // Validierung
    if (!data.jahr || !data.quartal) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Jahr und Quartal sind erforderlich' })
      };
    }

    // HIER KOMMT IHRE DATENBANK-LOGIK HIN
    // TODO: Ersetzen Sie dies mit Ihrem echten Datenbank-Aufruf
    
    // Beispiel für PostgreSQL:
    /*
    const { Pool } = require('pg');
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Prüfen ob Quartal bereits existiert
    const checkResult = await pool.query(
      'SELECT id FROM quartale WHERE jahr = $1 AND quartal = $2',
      [data.jahr, data.quartal]
    );

    if (checkResult.rows.length > 0) {
      // UPDATE
      await pool.query(`
        UPDATE quartale SET
          period_start = $1,
          period_end = $2,
          ueberschuss = $3,
          kontostand_aktuell = $4,
          kontostand_vorjahr = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE jahr = $6 AND quartal = $7
      `, [
        data.period_start,
        data.period_end,
        data.einnahmen_gesamt_aktuell - data.ausgaben_gesamt_aktuell,
        data.kontostand_aktuell,
        data.kontostand_vorjahr,
        data.jahr,
        data.quartal
      ]);

      const quartalId = checkResult.rows[0].id;

      // Update Einnahmen
      await pool.query(`
        INSERT INTO einnahmen_kategorien (
          quartal_id, spenden_aktuell, spenden_vorjahr,
          mission_aktuell, mission_vorjahr,
          sonstige_aktuell, sonstige_vorjahr,
          gesamt_aktuell, gesamt_vorjahr
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (quartal_id) DO UPDATE SET
          spenden_aktuell = EXCLUDED.spenden_aktuell,
          spenden_vorjahr = EXCLUDED.spenden_vorjahr,
          mission_aktuell = EXCLUDED.mission_aktuell,
          mission_vorjahr = EXCLUDED.mission_vorjahr,
          sonstige_aktuell = EXCLUDED.sonstige_aktuell,
          sonstige_vorjahr = EXCLUDED.sonstige_vorjahr,
          gesamt_aktuell = EXCLUDED.gesamt_aktuell,
          gesamt_vorjahr = EXCLUDED.gesamt_vorjahr,
          updated_at = CURRENT_TIMESTAMP
      `, [
        quartalId,
        data.spenden_aktuell,
        data.spenden_vorjahr,
        data.mission_einnahmen_aktuell,
        data.mission_einnahmen_vorjahr,
        data.sonstige_einnahmen_aktuell,
        data.sonstige_einnahmen_vorjahr,
        data.einnahmen_gesamt_aktuell,
        data.einnahmen_gesamt_vorjahr
      ]);

      // Update Ausgaben
      await pool.query(`
        INSERT INTO ausgaben_kategorien (
          quartal_id, gebaeude_aktuell, gebaeude_vorjahr,
          personal_aktuell, personal_vorjahr,
          sonstige_aktuell, sonstige_vorjahr,
          mission_aktuell, mission_vorjahr,
          gesamt_aktuell, gesamt_vorjahr
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (quartal_id) DO UPDATE SET
          gebaeude_aktuell = EXCLUDED.gebaeude_aktuell,
          gebaeude_vorjahr = EXCLUDED.gebaeude_vorjahr,
          personal_aktuell = EXCLUDED.personal_aktuell,
          personal_vorjahr = EXCLUDED.personal_vorjahr,
          sonstige_aktuell = EXCLUDED.sonstige_aktuell,
          sonstige_vorjahr = EXCLUDED.sonstige_vorjahr,
          mission_aktuell = EXCLUDED.mission_aktuell,
          mission_vorjahr = EXCLUDED.mission_vorjahr,
          gesamt_aktuell = EXCLUDED.gesamt_aktuell,
          gesamt_vorjahr = EXCLUDED.gesamt_vorjahr,
          updated_at = CURRENT_TIMESTAMP
      `, [
        quartalId,
        data.gebaeude_aktuell,
        data.gebaeude_vorjahr,
        data.personal_aktuell,
        data.personal_vorjahr,
        data.sonstige_ausgaben_aktuell,
        data.sonstige_ausgaben_vorjahr,
        data.mission_ausgaben_aktuell,
        data.mission_ausgaben_vorjahr,
        data.ausgaben_gesamt_aktuell,
        data.ausgaben_gesamt_vorjahr
      ]);

      // Update Spenderverhalten (falls Tabelle existiert)
      if (data.regelmaessig_prozent !== undefined) {
        await pool.query(`
          INSERT INTO spenderverhalten (
            quartal_id, regelmaessig_prozent, unregelmaessig_prozent
          ) VALUES ($1, $2, $3)
          ON CONFLICT (quartal_id) DO UPDATE SET
            regelmaessig_prozent = EXCLUDED.regelmaessig_prozent,
            unregelmaessig_prozent = EXCLUDED.unregelmaessig_prozent,
            updated_at = CURRENT_TIMESTAMP
        `, [quartalId, data.regelmaessig_prozent, data.unregelmaessig_prozent]);
      }

      // Update Quartalsziele
      await pool.query(`
        INSERT INTO quartalsziele (jahr, quartalsbedarf, visionsbetrag)
        VALUES ($1, $2, $3)
        ON CONFLICT (jahr) DO UPDATE SET
          quartalsbedarf = EXCLUDED.quartalsbedarf,
          visionsbetrag = EXCLUDED.visionsbetrag,
          updated_at = CURRENT_TIMESTAMP
      `, [data.jahr, data.quartalsbedarf, data.visionsbetrag]);

    } else {
      // INSERT (neues Quartal)
      const insertResult = await pool.query(`
        INSERT INTO quartale (
          jahr, quartal, period_start, period_end, ueberschuss,
          kontostand_aktuell, kontostand_vorjahr
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        data.jahr,
        data.quartal,
        data.period_start,
        data.period_end,
        data.einnahmen_gesamt_aktuell - data.ausgaben_gesamt_aktuell,
        data.kontostand_aktuell,
        data.kontostand_vorjahr
      ]);

      const quartalId = insertResult.rows[0].id;

      // Insert Einnahmen, Ausgaben, Spenderverhalten...
      // (gleicher Code wie oben beim UPDATE)
    }

    await pool.end();
    */

    // Für jetzt: Simulation einer erfolgreichen Speicherung
    console.log('Received quarter data:', data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: `Quartal ${data.quartal}/${data.jahr} erfolgreich gespeichert`,
        data: {
          jahr: data.jahr,
          quartal: data.quartal
        }
      })
    };

  } catch (error) {
    console.error('Error in save-quarter:', error);
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
