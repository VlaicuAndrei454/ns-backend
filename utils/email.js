// backend/utils/email.js
const nodemailer = require('nodemailer');

let transporterPromise;
if (process.env.NODE_ENV === 'development') {
  // Ethereal for local dev testing:
  transporterPromise = nodemailer.createTestAccount().then(testAcct =>
    nodemailer.createTransport({
      host: testAcct.smtp.host,
      port: testAcct.smtp.port,
      secure: testAcct.smtp.secure,
      auth: { user: testAcct.user, pass: testAcct.pass }
    })
  );
} else {
  // Sendinblue SMTP in production (or any NODE_ENV not 'development')
  transporterPromise = Promise.resolve(
    nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT, 10),
      secure: process.env.EMAIL_PORT === '465', // SSL if you choose port 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })
  );
}

module.exports = async ({ to, subject, text }) => {
  const transporter = await transporterPromise;
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text
  });

  // In dev, you’ll still get an Ethereal preview link
  if (process.env.NODE_ENV === 'development') {
    console.log("📬 Preview URL:", nodemailer.getTestMessageUrl(info));
  }
};
