const nodemailer = (() => {
  try {
    return require('nodemailer');
  } catch (error) {
    return null;
  }
})();

async function sendPasswordResetEmail(email, code) {
  const subject = 'MatchED - Código de recuperação de senha';
  const html = `
    <p>Olá,</p>
    <p>Recebemos uma solicitação para redefinir a sua senha no MatchED.</p>
    <p>Use o código abaixo para continuar:</p>
    <h2>${code}</h2>
    <p>O código expira em 15 minutos.</p>
    <p>Se você não solicitou essa alteração, ignore esta mensagem.</p>
    <p>Obrigado,<br/>Equipe MatchED</p>
  `;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM || 'no-reply@matched.com';

  if (nodemailer && smtpHost && smtpPort && smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: fromEmail,
      to: email,
      subject,
      html,
    });
    console.log(`✅ Password recovery email sent to ${email}`);
  } else {
    console.log('--- MatchED Password Reset Email ---');
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(html);
    console.log('--- End password reset email ---');
    console.log('NOTE: SMTP not configured; email logged to console.');
  }
}

module.exports = {
  sendPasswordResetEmail,
};
