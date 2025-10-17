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

    // HIER KOMMT IHRE DATENBANK-LOGIK HIN
    // Für jetzt simulieren wir die Daten
    
    // TODO: Ersetzen Sie dies mit Ihrem echten Datenbank-Aufruf
    // Beispiel:
    // const { Pool } = require('pg');
    // const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // const result = await pool.query('SELECT * FROM quartale WHERE jahr = $1', [jahr]);

    // Beispiel-Daten (wie Ihre API sie zurückgibt)
    const mockData = {
      quartale: [
        {
          quartal: 1,
          jahr: 2025,
          period_start: "2025-01-01",
          period_end: "2025-03-31",
          ueberschuss: "-3572.49",
          spenden_aktuell: "42632.15",
          spenden_vorjahr: "55485.27",
          mission_einnahmen_aktuell: "2831.41",
          mission_einnahmen_vorjahr: "2132.75",
          sonstige_einnahmen_aktuell: "23146.59",
          sonstige_einnahmen_vorjahr: "22335.76",
          gesamt_einnahmen_aktuell: "68610.15",
          gesamt_einnahmen_vorjahr: "79953.78",
          gebaeude_aktuell: "24159.53",
          gebaeude_vorjahr: "24104.69",
          personal_aktuell: "35613.77",
          personal_vorjahr: "34521.55",
          mission_ausgaben_aktuell: "2658.00",
          mission_ausgaben_vorjahr: "3368.74",
          sonstige_ausgaben_aktuell: "9751.34",
          sonstige_ausgaben_vorjahr: "9793.13",
          gesamt_ausgaben_aktuell: "72182.64",
          gesamt_ausgaben_vorjahr: "71788.11"
        },
        {
          quartal: 2,
          jahr: 2025,
          period_start: "2025-04-01",
          period_end: "2025-06-30",
          ueberschuss: "-5076.84",
          spenden_aktuell: "43749.15",
          spenden_vorjahr: "53548.14",
          mission_einnahmen_aktuell: "2648.72",
          mission_einnahmen_vorjahr: "713.90",
          sonstige_einnahmen_aktuell: "22960.43",
          sonstige_einnahmen_vorjahr: "27568.09",
          gesamt_einnahmen_aktuell: "69358.30",
          gesamt_einnahmen_vorjahr: "81830.13",
          gebaeude_aktuell: "25080.94",
          gebaeude_vorjahr: "24745.15",
          personal_aktuell: "37816.56",
          personal_vorjahr: "34863.93",
          mission_ausgaben_aktuell: "2515.51",
          mission_ausgaben_vorjahr: "1730.00",
          sonstige_ausgaben_aktuell: "9022.13",
          sonstige_ausgaben_vorjahr: "13950.15",
          gesamt_ausgaben_aktuell: "74435.14",
          gesamt_ausgaben_vorjahr: "75289.23"
        }
      ],
      quartalsziele: {
        quartalsbedarf: 75000,
        visionsbetrag: 81000
      },
      jahresuebersicht: {
        kumuliertes_ergebnis: -8649.33,
        gesamteinnahmen: 137968.45,
        gesamtausgaben: 146617.78
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(mockData)
    };

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
