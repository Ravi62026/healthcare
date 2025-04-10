const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Create reusable transporter with the provided credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'Your email id', // Replace with your Gmail address
    pass: 'Your app password, not the password of your gmail account'   // App password provided
  }
});

// Email template for appointment communications
const getEmailTemplate = (doctorName, patientName, message) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Healthcare Communication</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
        }
        .header {
          background-color: #e53e3e;
          color: white;
          padding: 20px;
          text-align: center;
        }
        .content {
          padding: 20px;
          background-color: #f9f9f9;
        }
        .footer {
          font-size: 12px;
          text-align: center;
          margin-top: 20px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>HealthCare System</h2>
      </div>
      <div class="content">
        <p>Dear ${patientName},</p>
        
        <div class="message">
          ${message.replace(/\n/g, '<br>')}
        </div>
        
        <p>Best regards,</p>
        <p>Dr. ${doctorName}</p>
      </div>
      <div class="footer">
        <p>This is an automated message from your healthcare provider. Please do not reply to this email.</p>
        <p>If you need to respond, please contact your doctor's office directly.</p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Send an email to a patient
 * @param {Object} options Email options
 * @param {string} options.recipient Recipient email address
 * @param {string} options.subject Email subject
 * @param {string} options.message Email message body
 * @param {string} options.patientName Patient's name
 * @param {string} options.doctorName Doctor's name
 * @param {Object} [options.attachment] Optional file attachment
 */
const sendEmail = async (options) => {
  try {
    const { recipient, subject, message, patientName, doctorName, attachment } = options;
    
    // Email options
    const mailOptions = {
      from: '"Healthcare System" <your_email@gmail.com>',
      to: recipient,
      subject: subject,
      html: getEmailTemplate(doctorName, patientName, message)
    };
    
    // Add attachment if provided
    if (attachment) {
      mailOptions.attachments = [{
        filename: attachment.originalname,
        content: attachment.buffer
      }];
    }
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent: %s', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  sendEmail
}; 