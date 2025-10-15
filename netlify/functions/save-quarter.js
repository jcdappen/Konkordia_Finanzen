const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const sql = neon(process.env.DATABASE_URL);

    // Validierung
    if (!data.jahr || !data.quartal) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Jahr und Quartal sind erforderlich' })
      };
    }

    // Transaktion starten
    await sql`BEGIN`;

    try {
      // 1. Jahr in jahresuebersicht einfügen (falls nicht vorhanden)
      await sql`
        INSERT INTO jahresuebersicht (jahr, gesamteinnahmen, gesamtausgaben, kumuliertes_ergebnis)
        VALUES (${data.jahr}, 0, 0, 0)
        ON CONFLICT (jahr) DO NOTHING
      `;

      // 2. Quartalsziele einfügen/aktualisieren
      await sql`
        INSERT INTO quartalsziele (jahr, quartalsbedarf, visionsbetrag)
        VALUES (${data.jahr}, ${data.quartalsbedarf || 75000}, ${data.visionsbetrag || 81000})
        ON CONFLICT (jahr) 
        DO UPDATE SET 
          quartalsbedarf = ${data.quartalsbedarf || 75000},
          visionsbetrag = ${data.visionsbetrag || 81000}
      `;

      // 3. Altes Quartal löschen (falls vorhanden)
      await sql`
        DELETE FROM quartale 
        WHERE jahr = ${data.jahr} AND quartal = ${data.quartal}
      `;

      // 4. Neues Quartal einfügen
      const quartalResult = await sql`
        INSERT INTO quartale (
          jahr, quartal, period_start, period_end, 
          ueberschuss, kontostand_aktuell, kontostand_vorjahr
        )
        VALUES (
          ${data.jahr}, ${data.quartal}, 
          ${data.period_start}, ${data.period_end},
          0, ${data.kontostand_aktuell || 0}, ${data.kontostand_vorjahr || 0}
        )
        RETURNING id
      `;
      
      const quartalId = quartalResult[0].id;

      // 5. Einnahmen einfügen
      const einnahmenGesamt = 
        (parseFloat(data.spenden_aktuell) || 0) +
        (parseFloat(data.mission_einnahmen_aktuell) || 0) +
        (parseFloat(data.sonstige_einnahmen_aktuell) || 0);
      
      const einnahmenGesamtVorjahr = 
        (parseFloat(data.spenden_vorjahr) || 0) +
        (parseFloat(data.mission_einnahmen_vorjahr) || 0) +
        (parseFloat(data.sonstige_einnahmen_vorjahr) || 0);

      await sql`
        INSERT INTO einnahmen_kategorien (
          quartal_id,
          spenden_aktuell, spenden_vorjahr,
          mission_aktuell, mission_vorjahr,
          sonstige_aktuell, sonstige_vorjahr,
          gesamt_aktuell, gesamt_vorjahr
        ) VALUES (
          ${quartalId},
          ${data.spenden_aktuell || 0}, ${data.spenden_vorjahr || 0},
          ${data.mission_einnahmen_aktuell || 0}, ${data.mission_einnahmen_vorjahr || 0},
          ${data.sonstige_einnahmen_aktuell || 0}, ${data.sonstige_einnahmen_vorjahr || 0},
          ${einnahmenGesamt}, ${einnahmenGesamtVorjahr}
        )
      `;

      // 6. Ausgaben einfügen
      const ausgabenGesamt = 
        (parseFloat(data.gebaeude_aktuell) || 0) +
        (parseFloat(data.personal_aktuell) || 0) +
        (parseFloat(data.sonstige_ausgaben_aktuell) || 0) +
        (parseFloat(data.mission_ausgaben_aktuell) || 0);
      
      const ausgabenGesamtVorjahr = 
        (parseFloat(data.gebaeude_vorjahr) || 0) +
        (parseFloat(data.personal_vorjahr) || 0) +
        (parseFloat(data.sonstige_ausgaben_vorjahr) || 0) +
        (parseFloat(data.mission_ausgaben_vorjahr) || 0);

      await sql`
        INSERT INTO ausgaben_kategorien (
          quartal_id,
          gebaeude_aktuell, gebaeude_vorjahr,
          personal_aktuell, personal_vorjahr,
          sonstige_aktuell, sonstige_vorjahr,
          mission_aktuell, mission_vorjahr,
          gesamt_aktuell, gesamt_vorjahr
        ) VALUES (
          ${quartalId},
          ${data.gebaeude_aktuell || 0}, ${data.gebaeude_vorjahr || 0},
          ${data.personal_aktuell || 0}, ${data.personal_vorjahr || 0},
          ${data.sonstige_ausgaben_aktuell || 0}, ${data.sonstige_ausgaben_vorjahr || 0},
          ${data.mission_ausgaben_aktuell || 0}, ${data.mission_ausgaben_vorjahr || 0},
          ${ausgabenGesamt}, ${ausgabenGesamtVorjahr}
        )
      `;

      // 7. Spenderverhalten einfügen
      if (data.regelmaessig_prozent && data.unregelmaessig_prozent) {
        await sql`
          INSERT INTO spenderverhalten (
            quartal_id, regelmaessig_prozent, unregelmaessig_prozent
          ) VALUES (
            ${quartalId},
            ${data.regelmaessig_prozent},
            ${data.unregelmaessig_prozent}
          )
        `;
      }

      // 8. Überschuss berechnen
      const ueberschuss = einnahmenGesamt - ausgabenGesamt;
      await sql`
        UPDATE quartale 
        SET ueberschuss = ${ueberschuss}
        WHERE id = ${quartalId}
      `;

      // 9. Jahresübersicht aktualisieren
      await sql`
        UPDATE jahresuebersicht
        SET 
          gesamteinnahmen = (
            SELECT COALESCE(SUM(gesamt_aktuell), 0) 
            FROM einnahmen_kategorien e 
            JOIN quartale q ON e.quartal_id = q.id 
            WHERE q.jahr = ${data.jahr}
          ),
          gesamtausgaben = (
            SELECT COALESCE(SUM(gesamt_aktuell), 0) 
            FROM ausgaben_kategorien a 
            JOIN quartale q ON a.quartal_id = q.id 
            WHERE q.jahr = ${data.jahr}
          ),
          kumuliertes_ergebnis = (
            SELECT COALESCE(SUM(ueberschuss), 0) 
            FROM quartale 
            WHERE jahr = ${data.jahr}
          )
        WHERE jahr = ${data.jahr}
      `;

      await sql`COMMIT`;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Quartalsdaten erfolgreich gespeichert',
          quartalId: quartalId
        })
      };

    } catch (error) {
      await sql`ROLLBACK`;
      throw error;
    }

  } catch (error) {
    console.error('Fehler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Fehler beim Speichern', 
        details: error.message 
      })
    };
  }
};
