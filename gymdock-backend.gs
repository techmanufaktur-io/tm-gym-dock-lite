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
  PUSH_SUBSCRIBERS_SHEET: 'PushSubscribers',
  PUSH_LOG_SHEET: 'PushBroadcastLog',
  ALERT_EMAIL:   'daniel.pudelko@savvytec.de',           // ← Deine E-Mail für Alerts
  GYM_NAME:      'GymDock Studio',
  // Wie lange gilt ein Check-in als "aktiv" (Minuten)?
  CHECKIN_ACTIVE_MINUTES: 120
};

// OneSignal-Credentials liegen in den Script Properties
// (Apps Script → Project Settings → Script Properties):
//   ONESIGNAL_APP_ID          = <App ID aus OneSignal Dashboard>
//   ONESIGNAL_REST_API_KEY    = <REST API Key aus OneSignal Dashboard>
function getOneSignalConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    appId: props.getProperty('ONESIGNAL_APP_ID'),
    apiKey: props.getProperty('ONESIGNAL_REST_API_KEY')
  };
}

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

  // Push: subscribe / update opt-in flags
  if (params.action === 'pushSubscribe') {
    return handlePushSubscribe(params);
  }

  // Push: broadcast presence to other opted-in users in same gym
  if (params.action === 'notifyPresence') {
    return handleNotifyPresence(params);
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

// ════════════════════════════════════════
//  PUSH NOTIFICATIONS (OneSignal)
// ════════════════════════════════════════

const PUSH_HEADERS = [
  'Email', 'Name', 'Gym', 'Company',
  'BroadcastPresence', 'ReceivePresence',
  'ConsentTs', 'UpdatedTs'
];

// Find row index (1-based) for a given email; returns -1 if not found
function findSubscriberRow(sheet, email) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase() === email) return i + 1;
  }
  return -1;
}

function handlePushSubscribe(data) {
  const email = String(data.email || '').toLowerCase().trim();
  if (!email) return jsonResponse({ success: false, error: 'Missing email' });

  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = getOrCreateSheet(ss, CONFIG.PUSH_SUBSCRIBERS_SHEET, PUSH_HEADERS);

  const now = new Date().toISOString();
  const broadcast = String(data.broadcastPresence) === 'true';
  const receive = String(data.receivePresence) === 'true';
  const rowIdx = findSubscriberRow(sheet, email);

  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 2, 1, 7).setValues([[
      data.name || '',
      data.gym || '',
      data.company || '',
      broadcast,
      receive,
      sheet.getRange(rowIdx, 7).getValue() || now,  // keep original consentTs
      now
    ]]);
  } else {
    sheet.appendRow([
      email,
      data.name || '',
      data.gym || '',
      data.company || '',
      broadcast,
      receive,
      now,
      now
    ]);
  }

  return jsonResponse({ success: true });
}

function handleNotifyPresence(data) {
  const senderEmail = String(data.senderEmail || '').toLowerCase().trim();
  const gym = String(data.gym || '').trim();
  if (!senderEmail || !gym) {
    return jsonResponse({ success: false, error: 'Missing senderEmail or gym' });
  }

  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const subs = ss.getSheetByName(CONFIG.PUSH_SUBSCRIBERS_SHEET);
  if (!subs) return jsonResponse({ success: false, error: 'No subscribers yet' });

  // Server-side opt-in check: sender must have broadcastPresence === true
  const rowIdx = findSubscriberRow(subs, senderEmail);
  if (rowIdx < 0) return jsonResponse({ success: false, error: 'Sender not subscribed' });
  const senderRow = subs.getRange(rowIdx, 1, 1, PUSH_HEADERS.length).getValues()[0];
  if (senderRow[4] !== true && String(senderRow[4]) !== 'true') {
    return jsonResponse({ success: false, error: 'Sender opted out' });
  }

  const senderFullName = String(data.senderName || senderRow[1] || '').trim();
  const firstName = senderFullName.split(' ')[0] || 'Someone';

  const result = sendOneSignalNotification({
    headings: { en: '💪 Co-Workout?' },
    contents: { en: firstName + ' ist gerade in ' + gym + ' eingecheckt — Lust auf Co-Workout?' },
    filters: [
      { field: 'tag', key: 'gym', relation: '=', value: gym },
      { operator: 'AND' },
      { field: 'tag', key: 'receivePresence', relation: '=', value: 'true' },
      { operator: 'AND' },
      { field: 'tag', key: 'userId', relation: '!=', value: senderEmail }
    ]
  });

  return jsonResponse({ success: true, result: result });
}

function sendOneSignalNotification(payload) {
  const cfg = getOneSignalConfig();
  if (!cfg.appId || !cfg.apiKey) {
    Logger.log('OneSignal not configured (Script Properties missing)');
    return { error: 'not_configured' };
  }
  payload.app_id = cfg.appId;

  try {
    const response = UrlFetchApp.fetch('https://api.onesignal.com/notifications', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Key ' + cfg.apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const text = response.getContentText();
    Logger.log('OneSignal response: ' + text);
    return JSON.parse(text);
  } catch (err) {
    Logger.log('OneSignal fetch error: ' + err.message);
    return { error: err.message };
  }
}

// ════════════════════════════════════════
//  ADMIN BROADCASTS (Custom Menu im Sheet)
// ════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📢 Push')
    .addItem('Broadcast to Gym…', 'broadcastToGym')
    .addItem('Broadcast to Company…', 'broadcastToCompany')
    .addItem('Broadcast to User…', 'broadcastToUser')
    .addSeparator()
    .addItem('Broadcast to ALL…', 'broadcastToAll')
    .addToUi();
}

function _promptText(ui, title, prompt) {
  const r = ui.prompt(title, prompt, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return null;
  const v = r.getResponseText().trim();
  return v || null;
}

function _runBroadcast(type, target, payload) {
  const ui = SpreadsheetApp.getUi();
  const result = sendOneSignalNotification(payload);
  logBroadcast(type, target, payload.headings.en, payload.contents.en, result);
  if (result.error) {
    ui.alert('Error', String(result.error), ui.ButtonSet.OK);
  } else {
    const recipients = (result.recipients !== undefined) ? result.recipients : '?';
    ui.alert('Sent ✓', 'Recipients: ' + recipients + '\nID: ' + (result.id || '—'), ui.ButtonSet.OK);
  }
}

function broadcastToGym() {
  const ui = SpreadsheetApp.getUi();
  const gym = _promptText(ui, 'Broadcast to Gym', 'Gym name (must match the user\'s gym tag exactly):');
  if (!gym) return;
  const title = _promptText(ui, 'Title', 'Notification title:');
  if (!title) return;
  const body = _promptText(ui, 'Body', 'Message:');
  if (!body) return;
  _runBroadcast('gym', gym, {
    headings: { en: title },
    contents: { en: body },
    filters: [{ field: 'tag', key: 'gym', relation: '=', value: gym }]
  });
}

function broadcastToCompany() {
  const ui = SpreadsheetApp.getUi();
  const company = _promptText(ui, 'Broadcast to Company', 'Company name:');
  if (!company) return;
  const title = _promptText(ui, 'Title', 'Notification title:');
  if (!title) return;
  const body = _promptText(ui, 'Body', 'Message:');
  if (!body) return;
  _runBroadcast('company', company, {
    headings: { en: title },
    contents: { en: body },
    filters: [{ field: 'tag', key: 'company', relation: '=', value: company }]
  });
}

function broadcastToUser() {
  const ui = SpreadsheetApp.getUi();
  const email = _promptText(ui, 'Broadcast to User', 'User email:');
  if (!email) return;
  const title = _promptText(ui, 'Title', 'Notification title:');
  if (!title) return;
  const body = _promptText(ui, 'Body', 'Message:');
  if (!body) return;
  _runBroadcast('user', email, {
    headings: { en: title },
    contents: { en: body },
    include_aliases: { external_id: [email.toLowerCase()] },
    target_channel: 'push'
  });
}

function broadcastToAll() {
  const ui = SpreadsheetApp.getUi();
  const c = ui.alert('Broadcast to ALL users?', 'Sends to every subscribed user across all gyms.', ui.ButtonSet.YES_NO);
  if (c !== ui.Button.YES) return;
  const title = _promptText(ui, 'Title', 'Notification title:');
  if (!title) return;
  const body = _promptText(ui, 'Body', 'Message:');
  if (!body) return;
  _runBroadcast('all', '*', {
    headings: { en: title },
    contents: { en: body },
    included_segments: ['Subscribed Users']
  });
}

function logBroadcast(type, target, title, body, result) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = getOrCreateSheet(ss, CONFIG.PUSH_LOG_SHEET, [
      'Timestamp', 'Type', 'Target', 'Title', 'Body', 'Result'
    ]);
    sheet.appendRow([
      new Date().toISOString(),
      type, target, title, body,
      JSON.stringify(result)
    ]);
  } catch (err) { Logger.log('logBroadcast error: ' + err.message); }
}
