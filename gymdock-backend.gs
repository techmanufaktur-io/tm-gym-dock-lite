/**
 * GymDock Backend · Google Apps Script
 * ──────────────────────────────────────
 * Deploy als: Web App → Execute as: Me → Who has access: Anyone
 *
 * Dieses Script empfängt:
 *   1. GET  /exec?name=…&email=… → Check-in von der PWA
 *   2. GET  /exec?source=shelly  → Bewegungserkennung vom Shelly Motion 2
 *
 * Es schreibt alle Events in Google Sheets und prüft
 * ob eine unbekannte Bewegung (kein aktiver Check-in) vorliegt.
 *
 * ── Setup ──
 * 1. Neues Google Sheet anlegen, Sheet-ID unten eintragen
 * 2. Script deployen: Erweiterungen → Apps Script → Deployen → Neue Deployment
 * 3. URL in GymDock PWA → Einstellungen eintragen
 */

// ════ KONFIGURATION ════
const CONFIG = {
  SHEET_ID: '15mep7f3mw1QqX1pWrNQ_PnHUuV3TnFjI2fHpcru0ATs',   // ← Sheet ID aus der URL
  CHECKIN_SHEET: 'CheckIns',
  MOTION_SHEET:  'Bewegungen',
  ALERT_EMAIL:   'daniel.pudelko@savvytec.de',           // ← Deine E-Mail für Alerts
  GYM_NAME:      'GymDock Studio',
  // Wie lange gilt ein Check-in als "aktiv" (Minuten)?
  CHECKIN_ACTIVE_MINUTES: 120
};

// ════ CORS HEADERS ════
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function jsonResponse(data, code) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════ ENTRY POINTS ════

function doOptions() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  const params = e.parameter;

  // Shelly Motion Webhook (GET request)
  if (params.source === 'shelly' || params.event === 'motion') {
    return handleMotionEvent({
      source: 'shelly',
      timestamp: new Date().toISOString(),
      device: params.device || 'shelly-motion-1'
    });
  }

  // Status check
  if (params.action === 'status') {
    return jsonResponse({ status: 'ok', gym: CONFIG.GYM_NAME, time: new Date().toISOString() });
  }

  // Active check-ins overview
  if (params.action === 'active') {
    return jsonResponse({ active: getActiveCheckIns() });
  }

  // Check-in from PWA (GET with URL params)
  if (params.name) {
    return handleCheckIn({
      name:      params.name,
      email:     params.email || '',
      timestamp: params.timestamp || new Date().toISOString(),
      date:      params.date || '',
      time:      params.time || '',
      gym:       params.gym || CONFIG.GYM_NAME
    });
  }

  return jsonResponse({ error: 'Unknown action' });
}

function doPost(e) {
  try {
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch {
      data = e.parameter;
    }

    // Route by type
    if (data.source === 'shelly' || data.event === 'motion_detected') {
      return handleMotionEvent(data);
    }

    // Default: Check-in from PWA
    return handleCheckIn(data);

  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ════ CHECK-IN HANDLER ════

function handleCheckIn(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = getOrCreateSheet(ss, CONFIG.CHECKIN_SHEET, [
    'Timestamp', 'Name', 'E-Mail', 'Gym', 'Datum', 'Uhrzeit', 'Wochentag'
  ]);

  const now = new Date();
  const ts  = data.timestamp ? new Date(data.timestamp) : now;

  sheet.appendRow([
    ts.toISOString(),
    data.name   || '—',
    data.email  || '—',
    data.gym    || CONFIG.GYM_NAME,
    Utilities.formatDate(ts, 'Europe/Berlin', 'dd.MM.yyyy'),
    Utilities.formatDate(ts, 'Europe/Berlin', 'HH:mm'),
    getWeekday(ts)
  ]);

  Logger.log(`Check-in: ${data.name} @ ${ts.toISOString()}`);

  return jsonResponse({
    success: true,
    message: `Check-in für ${data.name} registriert`,
    timestamp: ts.toISOString()
  });
}

// ════ MOTION EVENT HANDLER ════

function handleMotionEvent(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = getOrCreateSheet(ss, CONFIG.MOTION_SHEET, [
    'Timestamp', 'Device', 'Source', 'Aktiver Check-in', 'Alert gesendet'
  ]);

  const now = new Date();
  const activeCheckIns = getActiveCheckIns();
  const hasActiveUser = activeCheckIns.length > 0;
  const alertSent = !hasActiveUser;

  sheet.appendRow([
    now.toISOString(),
    data.device || 'shelly-motion-1',
    data.source || 'webhook',
    hasActiveUser ? activeCheckIns.map(c => c.name).join(', ') : 'NIEMAND',
    alertSent ? 'JA' : 'NEIN'
  ]);

  // Alert: Bewegung ohne Check-in
  if (!hasActiveUser) {
    sendMotionAlert(now);
  }

  return jsonResponse({
    success: true,
    motion: true,
    active_users: activeCheckIns.length,
    alert_sent: alertSent
  });
}

// ════ ACTIVE CHECK-INS ════

function getActiveCheckIns() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.CHECKIN_SHEET);
    if (!sheet) return [];

    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - CONFIG.CHECKIN_ACTIVE_MINUTES);

    const data = sheet.getDataRange().getValues();
    const active = [];

    // Skip header row (row 0)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const ts = new Date(row[0]); // Timestamp column
      if (ts > cutoff) {
        active.push({ name: row[1], email: row[2], timestamp: row[0] });
      }
    }
    return active;
  } catch (e) {
    Logger.log('Error getting active check-ins: ' + e.message);
    return [];
  }
}

// ════ EMAIL ALERT ════

function sendMotionAlert(timestamp) {
  try {
    const time = Utilities.formatDate(timestamp, 'Europe/Berlin', 'HH:mm');
    const date = Utilities.formatDate(timestamp, 'Europe/Berlin', 'dd.MM.yyyy');

    MailApp.sendEmail({
      to: CONFIG.ALERT_EMAIL,
      subject: `GymDock Alert: Bewegung ohne Check-in (${time})`,
      htmlBody: `
        <div style="font-family: sans-serif; max-width: 500px;">
          <h2 style="color: #c8f135; background: #0a0a0a; padding: 16px; border-radius: 8px;">
            GymDock Alarm
          </h2>
          <p><strong>Zeitpunkt:</strong> ${date} um ${time} Uhr</p>
          <p><strong>Studio:</strong> ${CONFIG.GYM_NAME}</p>
          <p style="color: #ff4444;"><strong>Problem:</strong> Bewegung erkannt, aber kein aktiver Check-in vorhanden.</p>
          <p>Jemand ist im Studio, hat sich aber <strong>nicht eingecheckt</strong>.</p>
          <hr />
          <p style="color: #666; font-size: 12px;">GymDock Phase 1 · savvytec</p>
        </div>
      `
    });
    Logger.log('Alert email sent');
  } catch (e) {
    Logger.log('Email error: ' + e.message);
  }
}

// ════ HELPERS ════

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    // Style header
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#0a0a0a');
    headerRange.setFontColor('#c8f135');
    headerRange.setFontWeight('bold');
  }
  return sheet;
}

function getWeekday(date) {
  const days = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  return days[date.getDay()];
}
