const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
  // Nur POST-Requests erlauben
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Passwort aus dem Request-Body holen
    const { password } = JSON.parse(event.body);

    // Passwort aus den Umgebungsvariablen holen (wird in Netlify Dashboard gesetzt)
    const correctPassword = process.env.DASHBOARD_PASSWORD;
    const jwtSecret = process.env.JWT_SECRET;

    // Prüfen ob Umgebungsvariablen gesetzt sind
    if (!correctPassword || !jwtSecret) {
      console.error('Environment variables not set!');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Passwort prüfen
    if (password === correctPassword) {
      // Token erstellen (gültig für 24 Stunden)
      const token = jwt.sign(
        { 
          authenticated: true,
          timestamp: Date.now()
        },
        jwtSecret,
        { expiresIn: '24h' }
      );

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          success: true, 
          token,
          message: 'Login erfolgreich'
        })
      };
    } else {
      // Falsches Passwort
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          success: false,
          message: 'Falsches Passwort'
        })
      };
    }

  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        error: 'Ein Fehler ist aufgetreten' 
      })
    };
  }
};
