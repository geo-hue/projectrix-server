// test-smtp.js
const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSMTP() {
  // Log the settings we're using (without the password)
  console.log('Testing SMTP connection with:');
  console.log('- Host:', process.env.EMAIL_HOST);
  console.log('- Port:', process.env.EMAIL_PORT);
  console.log('- User:', process.env.EMAIL_USER);
  console.log('- Secure:', process.env.EMAIL_SECURE === 'true');
  
  // Create transporter with detailed debug output
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    debug: true, // Enable debug output
    logger: true // Log to console
  });

  try {
    console.log('Verifying connection...');
    await transporter.verify();
    console.log('✅ Connection successful! SMTP server is ready to send emails.');
    
    // Optional: Try sending a test email
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: `"Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: "SMTP Test",
      text: "If you're seeing this, your SMTP configuration is working!"
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    
  } catch (error) {
    console.error('❌ SMTP connection failed:');
    console.error(error);
    
    // Provide more helpful error information
    if (error.code === 'EAUTH') {
      console.log('\nAuthentication failed. Possible reasons:');
      console.log('1. Incorrect username or password');
      console.log('2. Account has two-factor authentication enabled');
      console.log('3. Special characters in password causing issues');
      console.log('4. Email provider blocking "less secure apps"');
      console.log('5. IP restrictions on the email account'); 
    }
  }
}

testSMTP();