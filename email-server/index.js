import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';

const app = express();
const port = Number(process.env.PORT) || 3000;

const allowOrigin = process.env.ALLOW_ORIGIN || '*';
app.use(
  cors({
    origin: allowOrigin === '*' ? true : allowOrigin.split(',').map((s) => s.trim()),
    methods: ['POST', 'OPTIONS'],
  })
);
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'mel-rsvp-mail' });
});

function checkSecret(req) {
  const secret = process.env.RSVP_SECRET;
  if (!secret) return true;
  const auth = req.headers.authorization || '';
  return auth === `Bearer ${secret}`;
}

app.post('/api/rsvp', async (req, res) => {
  if (!checkSecret(req)) {
    return res.status(401).json({ ok: false, error: 'no autorizado' });
  }

  const { nombre, cantidad, adultos, ninos, restricciones, mensaje, _honey } = req.body || {};
  if (_honey) {
    return res.status(200).json({ ok: true });
  }

  const missing = ['nombre', 'cantidad'].filter((k) => !String(req.body?.[k] ?? '').trim());
  if (missing.length) {
    return res.status(400).json({ ok: false, error: 'faltan datos' });
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.MAIL_TO;

  if (!host || !user || !pass || !to) {
    console.error('Falta configurar SMTP o MAIL_TO en .env');
    return res.status(500).json({ ok: false, error: 'servidor sin configurar' });
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });

  const text =
    `Confirmación de asistencia - 15 de Melina\n\n` +
    `Nombre: ${nombre}\n` +
    `Cantidad total: ${cantidad}\n` +
    `Adultos: ${adultos ?? ''}\n` +
    `Niños: ${ninos ?? ''}\n` +
    `Restricciones alimentarias: ${restricciones || '—'}\n` +
    `Mensaje: ${mensaje || '—'}\n`;

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || user,
      to,
      subject: 'Confirmación de asistencia - 15 de Melina',
      text,
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'no se pudo enviar el correo' });
  }
});

app.listen(port, () => {
  console.log(`RSVP mail escuchando en :${port}`);
});
