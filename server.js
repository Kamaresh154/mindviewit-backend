const express    = require('express');
const nodemailer = require('nodemailer');
const cors       = require('cors');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.options('*', cors());

/* Strip spaces from app password in case Render adds quotes or spaces */
const SMTP_PASS = (process.env.SMTP_PASSWORD || '').replace(/\s/g, '');
const SMTP_USER = (process.env.SMTP_EMAIL    || '').trim();
const ADMIN     = (process.env.ADMIN_EMAIL   || SMTP_USER).trim();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,          /* SSL — more reliable than STARTTLS on port 587 */
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

/* ── Health check ── */
app.get('/', (req, res) => {
  res.json({
    status: 'MindView IT email server is running',
    smtp_user_set: !!SMTP_USER,
    smtp_pass_set: !!SMTP_PASS,
    admin_set:     !!ADMIN
  });
});

/* ── Test email route — visit /test-email in browser to verify Gmail works ── */
app.get('/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from: `"MindView IT Test" <${SMTP_USER}>`,
      to:   ADMIN,
      subject: 'Test Email from MindView Backend',
      text:    'If you received this, your email setup is working correctly!'
    });
    res.json({ success: true, message: 'Test email sent to ' + ADMIN });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, code: err.code });
  }
});

/* ══════════════════════════════════════════
   POST /send-application
══════════════════════════════════════════ */
app.post('/send-application', async (req, res) => {
  const { name, email, jobTitle, passed, score, resumeSnippet } = req.body;

  if (!name || !email || !jobTitle) {
    return res.status(400).json({ error: 'Missing required fields: name, email, jobTitle' });
  }

  const statusColor = passed ? '#155724' : '#721c24';
  const statusBg    = passed ? '#d4edda'  : '#f8d7da';
  const statusText  = passed ? 'SHORTLISTED ✓' : 'NOT SELECTED';
  const resultMsg   = passed
    ? 'We are pleased to inform you that your resume has been successfully shortlisted. Our HR team will contact you within the next few working days.'
    : 'After careful review, your profile does not fully align with the current requirements. We appreciate your interest and encourage you to apply for future openings.';

  const candidateHtml = `
    <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;">
      <div style="background:#0a192f;padding:25px;text-align:center;">
        <h2 style="color:#64ffda;margin:0;">MindView IT Services</h2>
      </div>
      <div style="padding:30px;">
        <p>Dear <strong>${name}</strong>,</p>
        <p>Thank you for applying for the <strong>${jobTitle}</strong> position.</p>
        <p style="background:${statusBg};padding:15px;border-radius:8px;color:${statusColor};font-weight:600;">
          Status: ${statusText} &nbsp;|&nbsp; ATS Score: ${score}%
        </p>
        <p>${resultMsg}</p>
        <hr style="border:none;border-top:1px solid #e9ecef;">
        <p style="font-size:0.85rem;color:#6c757d;">
          Warm Regards,<br><strong>HR Team</strong><br>MindView IT Services
        </p>
      </div>
    </div>`;

  const adminHtml = `
    <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;">
      <div style="background:#0a192f;padding:25px;">
        <h2 style="color:#64ffda;margin:0;">New Application Received</h2>
      </div>
      <div style="padding:30px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;font-weight:600;width:120px;">Name:</td><td>${name}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Email:</td><td>${email}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Position:</td><td>${jobTitle}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Status:</td>
            <td style="color:${statusColor};font-weight:600;">${statusText} (Score: ${score}%)</td></tr>
        </table>
        <hr>
        <h3>Resume Snippet</h3>
        <pre style="white-space:pre-wrap;font-size:0.85rem;background:#f8f9fa;padding:15px;border-radius:8px;">${(resumeSnippet || '').substring(0, 5000)}</pre>
      </div>
    </div>`;

  try {
    await transporter.sendMail({
      from:    `"MindView IT Services" <${SMTP_USER}>`,
      to:      email,
      subject: `Application Received – ${jobTitle} | MindView IT Services`,
      html:    candidateHtml
    });
    await transporter.sendMail({
      from:    `"MindView IT Services" <${SMTP_USER}>`,
      to:      ADMIN,
      subject: `New Application – ${name} for ${jobTitle}`,
      html:    adminHtml
    });
    res.json({ success: true });
  } catch (err) {
    console.error('send-application error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════
   POST /send-contact
══════════════════════════════════════════ */
app.post('/send-contact', async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields: name, email, message' });
  }

  const contactHtml = `
    <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;">
      <div style="background:#0a192f;padding:25px;">
        <h2 style="color:#64ffda;margin:0;">New Contact Enquiry</h2>
      </div>
      <div style="padding:30px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;font-weight:600;width:100px;">Name:</td><td>${name}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Email:</td><td>${email}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Subject:</td><td>${subject || 'Contact Enquiry'}</td></tr>
        </table>
        <hr>
        <h3>Message</h3>
        <p style="white-space:pre-wrap;">${message}</p>
      </div>
    </div>`;

  try {
    await transporter.sendMail({
      from:    `"${name} via MindView Contact" <${SMTP_USER}>`,
      to:      ADMIN,
      replyTo: email,
      subject: `Contact: ${subject || 'New Enquiry'} – from ${name}`,
      html:    contactHtml
    });
    res.json({ success: true });
  } catch (err) {
    console.error('send-contact error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
