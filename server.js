const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: '*',  // allows GitHub Pages and local testing
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.options('*', cors()); // handle preflight requests

/* ── Gmail transporter using env variables ── */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD  // Gmail App Password (spaces are fine)
  }
});

/* ── Health check ── */
app.get('/', (req, res) => {
  res.json({ status: 'MindView IT email server is running' });
});

/* ══════════════════════════════════════════
   POST /send-application
   Called from careers page after ATS check.
   Body: { name, email, jobTitle, passed, score, resumeSnippet }
══════════════════════════════════════════ */
app.post('/send-application', async (req, res) => {
  const { name, email, jobTitle, passed, score, resumeSnippet } = req.body;

  if (!name || !email || !jobTitle) {
    return res.status(400).json({ error: 'Missing required fields: name, email, jobTitle' });
  }

  const statusColor  = passed ? '#155724' : '#721c24';
  const statusBg     = passed ? '#d4edda'  : '#f8d7da';
  const statusText   = passed ? 'SHORTLISTED ✓' : 'NOT SELECTED';
  const resultMsg    = passed
    ? 'We are pleased to inform you that your resume has been successfully shortlisted after our initial screening. Our HR team will contact you with further details within the next few working days.'
    : 'After careful review, we regret that your profile does not fully align with the current requirements for this role. We appreciate your interest and encourage you to apply for future openings.';

  /* Email to candidate */
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

  /* Email to admin */
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
    /* Send to candidate */
    await transporter.sendMail({
      from: `"MindView IT Services" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: `Application Received – ${jobTitle} | MindView IT Services`,
      html: candidateHtml
    });

    /* Send to admin */
    await transporter.sendMail({
      from: `"MindView IT Services" <${process.env.SMTP_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `New Application – ${name} for ${jobTitle}`,
      html: adminHtml
    });

    res.json({ success: true, message: 'Emails sent successfully' });
  } catch (err) {
    console.error('Send application error:', err);
    res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
});

/* ══════════════════════════════════════════
   POST /send-contact
   Called from the contact page form.
   Body: { name, email, subject, message }
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
      from: `"${name} via MindView Contact" <${process.env.SMTP_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      replyTo: email,
      subject: `Contact: ${subject || 'New Enquiry'} – from ${name}`,
      html: contactHtml
    });

    res.json({ success: true, message: 'Message sent successfully' });
  } catch (err) {
    console.error('Send contact error:', err);
    res.status(500).json({ error: 'Failed to send message', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
