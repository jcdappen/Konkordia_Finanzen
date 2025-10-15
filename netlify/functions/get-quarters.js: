const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const { jahr } = event.queryStringParameters || { jahr: 2025 };

    // Jahresübersicht abrufen
    const jahresuebersicht = await sql`
      SELECT * FROM jahresuebersicht WHERE jahr = ${jahr}
    `;

    // Quartalsziele abrufen
    const quartalsziele = await sql`
      SELECT * FROM quartalsziele WHERE jahr = ${jahr}
    `;

    // Alle Quartale mit allen Details abrufen
    const quartale = await sql`
      SELECT 
        q.id,
        q.jahr,
        q.quartal,
        q.period_start,
        q.period_end,
        q.ueberschuss,
        q.kontostand_aktuell,
        q.kontostand_vorjahr,
        
        -- Einnahmen
        e.spenden_aktuell,
        e.spenden_vorjahr,
        e.mission_aktuell as mission_einnahmen_aktuell,
        e.mission_vorjahr as mission_einnahmen_vorjahr,
        e.sonstige_aktuell as sonstige_einnahmen_aktuell,
        e.sonstige_vorjahr as sonstige_einnahmen_vorjahr,
        e.gesamt_aktuell as gesamt_einnahmen_aktuell,
        e.gesamt_vorjahr as gesamt_einnahmen_vorjahr,
        
        -- Ausgaben
        a.gebaeude_aktuell,
        a.gebaeude_vorjahr,
        a.personal_aktuell,
        a.personal_vorjahr,
        a.sonstige_aktuell as sonstige_ausgaben_aktuell,
        a.sonstige_vorjahr as sonstige_ausgaben_vorjahr,
        a.mission_aktuell as mission_ausgaben_aktuell,
        a.mission_vorjahr as mission_ausgaben_vorjahr,
        a.gesamt_aktuell as gesamt_ausgaben_aktuell,
        a.gesamt_vorjahr as gesamt_ausgaben_vorjahr,
        
        -- Spenderverhalten
        s.regelmaessig_prozent,
        s.unregelmaessig_prozent
        
      FROM quartale q
      LEFT JOIN einnahmen_kategorien e ON q.id = e.quartal_id
      LEFT JOIN ausgaben_kategorien a ON q.id = a.quartal_id
      LEFT JOIN spenderverhalten s ON q.id = s.quartal_id
      WHERE q.jahr = ${jahr}
      ORDER BY q.quartal ASC
    `;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        jahresuebersicht: jahresuebersicht[0] || null,
        quartalsziele: quartalsziele[0] || { quartalsbedarf: 75000, visionsbetrag: 81000 },
        quartale: quartale
      })
    };

  } catch (error) {
    console.error('Fehler beim Abrufen der Daten:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Fehler beim Abrufen der Daten',
        details: error.message 
      })
    };
  }
};
