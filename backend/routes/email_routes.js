const express = require('express');
const router = express.Router();
const multer = require('multer');
const emailService = require('../services/email_service');

// Configure multer for memory storage (to handle file uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // Limit file size to 5MB
  }
});

/**
 * @route POST /api/send-email
 * @description Send email to patient with optional attachment
 * @access Private (Doctor only)
 */
router.post('/send-email', upload.single('attachment'), async (req, res) => {
  try {
    const { recipient, subject, message, patientName, doctorName } = req.body;
    
    // Validate required fields
    if (!recipient || !subject || !message || !patientName || !doctorName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    // Create email options
    const emailOptions = {
      recipient,
      subject,
      message,
      patientName,
      doctorName
    };
    
    // Add attachment if provided
    if (req.file) {
      emailOptions.attachment = req.file;
    }
    
    // Send email
    const result = await emailService.sendEmail(emailOptions);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to send email',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error in send-email route:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router; 