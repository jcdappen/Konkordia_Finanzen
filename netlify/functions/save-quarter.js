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
      // Berechne Gesamtsummen
      const einnahmenGesamtAktuell = parseFloat(data.spenden_aktuell || 0) + 
                                     parseFloat(data.mission_einnahmen_aktuell || 0) + 
                                     parseFloat(data.sonstige_einnahmen_aktuell || 0);
      
      const einnahmenGesamtVorjahr = parseFloat(data.spenden_vorjahr || 0) + 
                                     parseFloat(data.mission_einnahmen_vorjahr || 0) + 
                                     parseFloat(data.sonstige_einnahmen_vorjahr || 0);
      
      const ausgabenGesamtAktuell = parseFloat(data.gebaeude_aktuell || 0) + 
                                    parseFloat(data.personal_aktuell || 0) + 
                                    parseFloat(data.mission_ausgaben_aktuell || 0) + 
                                    parseFloat(data.sonstige_ausgaben_aktuell || 0);
      
      const ausgabenGesamtVorjahr = parseFloat(data.gebaeude_vorjahr || 0) + 
                                    parseFloat(data.personal_vorjahr || 0) + 
                                    parseFloat(data.mission_ausgaben_vorjahr || 0) + 
                                    parseFloat(data.sonstige_ausgaben_vorjahr || 0);
      
      const ueberschuss = einnahmenGesamtAktuell - ausgabenGesamtAktuell;

      // Prüfen ob Quartal bereits existiert
      const checkResult = await pool.query(
        'SELECT id FROM quartale WHERE jahr = $1 AND quartal = $2',
        [data.jahr, data.quartal]
      );

      let quartalId;
      let isUpdate = false;

      if (checkResult.rows.length > 0) {
        // UPDATE existierendes Quartal
        isUpdate = true;
        quartalId = checkResult.rows[0].id;
        
        await pool.query(`
          UPDATE quartale SET
            period_start = $1,
            period_end = $2,
            ueberschuss = $3,
            kontostand_aktuell = $4,
            kontostand_vorjahr = $5,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
        `, [
          data.period_start,
          data.period_end,
          ueberschuss,
          data.kontostand_aktuell || 0,
          data.kontostand_vorjahr || 0,
          quartalId
        ]);

      } else {
        // INSERT neues Quartal
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
          ueberschuss,
          data.kontostand_aktuell || 0,
          data.kontostand_vorjahr || 0
        ]);

        quartalId = insertResult.rows[0].id;
      }

      // UPSERT Einnahmen Kategorien
      await pool.query(`
        INSERT INTO einnahmen_kategorien (
          quartal_id, 
          spenden_aktuell, spenden_vorjahr,
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
        data.spenden_aktuell || 0,
        data.spenden_vorjahr || 0,
        data.mission_einnahmen_aktuell || 0,
        data.mission_einnahmen_vorjahr || 0,
        data.sonstige_einnahmen_aktuell || 0,
        data.sonstige_einnahmen_vorjahr || 0,
        einnahmenGesamtAktuell,
        einnahmenGesamtVorjahr
      ]);

      // UPSERT Ausgaben Kategorien
      await pool.query(`
        INSERT INTO ausgaben_kategorien (
          quartal_id,
          gebaeude_aktuell, gebaeude_vorjahr,
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
        data.gebaeude_aktuell || 0,
        data.gebaeude_vorjahr || 0,
        data.personal_aktuell || 0,
        data.personal_vorjahr || 0,
        data.sonstige_ausgaben_aktuell || 0,
        data.sonstige_ausgaben_vorjahr || 0,
        data.mission_ausgaben_aktuell || 0,
        data.mission_ausgaben_vorjahr || 0,
        ausgabenGesamtAktuell,
        ausgabenGesamtVorjahr
      ]);

      // UPSERT Spenderverhalten (falls angegeben)
      if (data.regelmaessig_prozent !== undefined && data.unregelmaessig_prozent !== undefined) {
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

      // UPSERT Quartalsziele
      await pool.query(`
        INSERT INTO quartalsziele (jahr, quartalsbedarf, visionsbetrag)
        VALUES ($1, $2, $3)
        ON CONFLICT (jahr) DO UPDATE SET
          quartalsbedarf = EXCLUDED.quartalsbedarf,
          visionsbetrag = EXCLUDED.visionsbetrag,
          updated_at = CURRENT_TIMESTAMP
      `, [data.jahr, data.quartalsbedarf || 75000, data.visionsbetrag || 81000]);

      // Jahresübersicht aktualisieren
      // Alle Quartale des Jahres summieren
      const jahresSummeResult = await pool.query(`
        SELECT 
          COALESCE(SUM(e.gesamt_aktuell), 0) as gesamteinnahmen,
          COALESCE(SUM(a.gesamt_aktuell), 0) as gesamtausgaben,
          COALESCE(SUM(q.ueberschuss), 0) as kumuliertes_ergebnis
        FROM quartale q
        LEFT JOIN einnahmen_kategorien e ON q.id = e.quartal_id
        LEFT JOIN ausgaben_kategorien a ON q.id = a.quartal_id
        WHERE q.jahr = $1
      `, [data.jahr]);

      const jahresSumme = jahresSummeResult.rows[0];

      await pool.query(`
        INSERT INTO jahresuebersicht (jahr, gesamteinnahmen, gesamtausgaben, kumuliertes_ergebnis)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (jahr) DO UPDATE SET
          gesamteinnahmen = EXCLUDED.gesamteinnahmen,
          gesamtausgaben = EXCLUDED.gesamtausgaben,
          kumuliertes_ergebnis = EXCLUDED.kumuliertes_ergebnis,
          updated_at = CURRENT_TIMESTAMP
      `, [
        data.jahr,
        jahresSumme.gesamteinnahmen,
        jahresSumme.gesamtausgaben,
        jahresSumme.kumuliertes_ergebnis
      ]);

      await pool.end();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: `Quartal ${data.quartal}/${data.jahr} erfolgreich ${isUpdate ? 'aktualisiert' : 'gespeichert'}`,
          data: {
            jahr: data.jahr,
            quartal: data.quartal,
            quartalId: quartalId,
            ueberschuss: ueberschuss
          }
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
