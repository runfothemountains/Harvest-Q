// --- Notify Agent tools ---
const tools = [
  // …keep existing tools…

  {
    type: 'function',
    function: {
      name: 'sendEmail',
      description: 'Send a structured email notification.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address.' },
          subject: { type: 'string' },
          body: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags: match|grant|delivery|system' }
        },
        required: ['to','subject','body']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'sendSMS',
      description: 'Send a short text/SMS notification.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient phone number (E.164 if possible).' },
          message: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['to','message']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'pushAlert',
      description: 'Trigger an in-app/web push alert for a user.',
      parameters: {
        type: 'object',
        properties: {
          recipientId: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['recipientId','title','message']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'scheduleNotification',
      description: 'Schedule a notification to be sent later (demo scheduler).',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: ['email','sms','app'], default: 'app' },
          recipient: { type: 'string' },
          subject: { type: 'string', description: 'Required for email.' },
          message: { type: 'string' },
          runAt: { type: 'string', description: 'ISO timestamp for future send.' },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['channel','recipient','message','runAt']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'getNotificationHistory',
      description: 'Return recent notifications (optionally filtered by recipient).',
      parameters: {
        type: 'object',
        properties: {
          recipient: { type: 'string', description: 'Optional filter.' },
          limit: { type: 'number', default: 20 }
        }
      }
    }
  }
];

// --- Notify Agent implementations ---

// Simple in-memory stores for demo
const _notifLog = [];      // { id, channel, recipient, subject, message, tags[], status, ts }
const _scheduledJobs = []; // { id, channel, recipient, subject, message, runAt, tags[], status }

// Utility: mask contact when echoing back
function _mask(s='') {
  if (!s) return s;
  if (s.includes('@')) {
    const [u, d] = s.split('@');
    return (u.length > 1 ? u[0] + '***' : '*') + '@' + d;
  }
  // phone
  return s.replace(/.(?=.{4})/g, '*');
}

function _logNotification(entry) {
  _notifLog.unshift(entry);
  // keep last 200
  if (_notifLog.length > 200) _notifLog.pop();
}

// 1) sendEmail
async function sendEmail({ to, subject, body, tags = [] }) {
  const id = `EM-${Date.now()}`;
  const ts = new Date().toISOString();
  const entry = { id, channel: 'email', recipient: to, subject, message: body, tags, status: 'sent', ts };
  _logNotification(entry);
  // In production: call actual email service here
  return { ok: true, id, channel: 'email', to: _mask(to), subject, preview: body.slice(0, 100), ts };
}

// 2) sendSMS
async function sendSMS({ to, message, tags = [] }) {
  const id = `SM-${Date.now()}`;
  const ts = new Date().toISOString();
  const entry = { id, channel: 'sms', recipient: to, subject: null, message, tags, status: 'sent', ts };
  _logNotification(entry);
  // In production: call SMS provider
  return { ok: true, id, channel: 'sms', to: _mask(to), preview: message.slice(0, 100), ts };
}

// 3) pushAlert
async function pushAlert({ recipientId, title, message, tags = [] }) {
  const id = `PA-${Date.now()}`;
  const ts = new Date().toISOString();
  const entry = { id, channel: 'app', recipient: recipientId, subject: title, message, tags, status: 'sent', ts };
  _logNotification(entry);
  return { ok: true, id, channel: 'app', recipientId, title, preview: message.slice(0, 100), ts };
}

// 4) scheduleNotification (demo: store it; your UI/cron can poll and dispatch)
async function scheduleNotification({ channel = 'app', recipient, subject, message, runAt, tags = [] }) {
  const id = `SC-${Date.now()}`;
  const ts = new Date().toISOString();
  const job = { id, channel, recipient, subject: subject || null, message, runAt, tags, status: 'scheduled', ts };
  _scheduledJobs.unshift(job);
  return { ok: true, id, channel, recipient: _mask(recipient), runAt, status: 'scheduled' };
}

// 5) getNotificationHistory
async function getNotificationHistory({ recipient, limit = 20 } = {}) {
  const list = recipient
    ? _notifLog.filter(n => n.recipient === recipient).slice(0, limit)
    : _notifLog.slice(0, limit);
  // mask sensitive fields
  const safe = list.map(n => ({
    id: n.id,
    channel: n.channel,
    recipient: _mask(n.recipient),
    subject: n.subject,
    preview: (n.message || '').slice(0, 100),
    tags: n.tags,
    status: n.status,
    ts: n.ts
  }));
  return { count: safe.length, items: safe };
}

const toolImpl = {
  // …existing implementations…
  sendEmail,
  sendSMS,
  pushAlert,
  scheduleNotification,
  getNotificationHistory
};

# sendEmail
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"sendEmail","args":{"to":"buyer@example.com","subject":"Match found","body":"A supplier has an offer for 500 kg Tomatoes.","tags":["match"]}}' | jq

# sendSMS
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"sendSMS","args":{"to":"+15551234567","message":"Pickup tomorrow 9:00 AM for 200 kg maize.","tags":["delivery"]}}' | jq

# pushAlert
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"pushAlert","args":{"recipientId":"farmer-2","title":"Grant update","message":"Your application scored 0.82.","tags":["grant"]}}' | jq

# scheduleNotification
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"scheduleNotification","args":{"channel":"email","recipient":"farmer@example.com","subject":"Reminder","message":"Co-op meeting at 4pm.","runAt":"2025-11-03T16:00:00Z","tags":["coop"]}}' | jq

# getNotificationHistory
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"getNotificationHistory","args":{"limit":5}}' | jq

