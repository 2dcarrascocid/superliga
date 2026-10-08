// Formulario de contacto del landing: se envía directo desde el navegador
// vía la API REST de EmailJS (no pasa por el backend).
const EMAILJS_URL = 'https://api.emailjs.com/api/v1.0/email/send';
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export async function sendContact(data) {
  // Honeypot lleno = bot: se descarta en silencio
  if (data.website) return;

  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    throw new Error('EmailJS no configurado: faltan VITE_EMAILJS_SERVICE_ID / TEMPLATE_ID / PUBLIC_KEY');
  }

  const res = await fetch(EMAILJS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: SERVICE_ID,
      template_id: TEMPLATE_ID,
      user_id: PUBLIC_KEY,
      template_params: {
        name: data.name,
        email: data.email,
        reply_to: data.email,
        // La plantilla solo usa {{message}}: teléfono y liga van concatenados ahí
        message: [
          `Teléfono: ${data.phone || '—'}`,
          `Liga / organización: ${data.organization || '—'}`,
          '',
          data.message || '—',
        ].join('\n'),
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`EmailJS ${res.status}: ${await res.text()}`);
  }
}
