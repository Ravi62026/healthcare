const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const appointments = require('./appointments');
const fs = require('fs');
const path = require('path');
const emailRoutes = require('./routes/email_routes');

const app = express();
const port = 4000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Get available slots for a specific date
app.get('/api/available-slots', (req, res) => {
  const { date = new Date().toISOString().split('T')[0] } = req.query;
  const availableSlots = appointments.getAllAvailableSlots(date);
  res.json({ available_slots: availableSlots });
});

// Book an appointment
app.post('/api/book-appointment', (req, res) => {
  const { doctorId, date, time, ...patientDetails } = req.body;
  
  // Validate required fields
  if (!doctorId || !date || !time) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields'
    });
  }

  // Try to book the slot
  const result = appointments.bookSlot(doctorId, date, time);
  
  if (!result.success) {
    return res.status(409).json(result); // 409 Conflict
  }

  // Return success with booked appointment details
  res.json({
    success: true,
    message: 'Appointment booked successfully',
    appointment: {
      doctorId,
      date,
      time,
      ...patientDetails
    }
  });
});

// Cancel an appointment
app.post('/api/cancel-appointment', (req, res) => {
  const { doctorId, date, time } = req.body;
  
  // Validate required fields
  if (!doctorId || !date || !time) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields'
    });
  }

  // Try to cancel the slot
  const result = appointments.cancelSlot(doctorId, date, time);
  
  if (!result.success) {
    return res.status(404).json(result); // 404 Not Found
  }

  res.json(result);
});

// Check appointment
app.post('/api/check-appointment', (req, res) => {
  const { email, phone } = req.body;
  
  // In a real application, you would query your database here
  // For now, we'll return a mock response
  res.json({
    found: true,
    appointment_count: 1,
    appointments: [{
      name: "John Doe",
      email: email || "john@example.com",
      phone: phone || "1234567890",
      doctor: "Dr. Smith",
      appointment_date: "2024-03-20",
      appointment_time: "10:00",
      reason: "Regular checkup"
    }]
  });
});

// Get doctors list with pagination
app.get('/api/doctors', (req, res) => {
  const { page = 1, limit = 10, specialty = '', search = '' } = req.query;
  const doctorsData = require('../doctor.json');
  
  let filteredDoctors = doctorsData.doctors;

  // Filter by specialty if provided
  if (specialty) {
    filteredDoctors = filteredDoctors.filter(doctor => 
      doctor.specialty.toLowerCase().includes(specialty.toLowerCase())
    );
  }

  // Filter by search term (searches in name, specialty, and qualification)
  if (search) {
    const searchLower = search.toLowerCase();
    filteredDoctors = filteredDoctors.filter(doctor => 
      doctor.name.toLowerCase().includes(searchLower) ||
      doctor.specialty.toLowerCase().includes(searchLower) ||
      doctor.qualification.toLowerCase().includes(searchLower)
    );
  }

  // Calculate pagination
  const startIndex = (Number(page) - 1) * Number(limit);
  const endIndex = startIndex + Number(limit);
  const totalDoctors = filteredDoctors.length;
  const totalPages = Math.ceil(totalDoctors / Number(limit));

  // Get doctors for current page
  const paginatedDoctors = filteredDoctors.slice(startIndex, endIndex);

  // Add availability status for each doctor
  const doctorsWithAvailability = paginatedDoctors.map(doctor => {
    const todayDate = new Date().toISOString().split('T')[0];
    const availableSlots = appointments.getAvailableSlots(doctor.id, todayDate);
    return {
      ...doctor,
      available_today: availableSlots.length > 0,
      next_available_slot: availableSlots[0] || null,
      total_slots_today: availableSlots.length
    };
  });

  res.json({
    success: true,
    data: {
      doctors: doctorsWithAvailability,
      pagination: {
        total_doctors: totalDoctors,
        total_pages: totalPages,
        current_page: Number(page),
        limit: Number(limit),
        has_next: endIndex < totalDoctors,
        has_previous: startIndex > 0
      },
      filters: {
        specialty,
        search
      }
    }
  });
});

// Welcome message and session initialization
app.get('/api/welcome', (req, res) => {
  const sessionId = Math.random().toString(36).substring(7);
  res.json({
    session_id: sessionId,
    response: "Welcome to the Healthcare Assistant! How can I help you today?\n\n" +
              "1. Book an appointment\n" +
              "2. Check existing appointment\n" +
              "3. Cancel appointment\n" +
              "4. View available doctors\n" +
              "5. Check symptoms"
  });
});

// Chat endpoint
app.post('/api/chat', (req, res) => {
  const { message, session_id } = req.body;
  
  // Here you would typically process the message through a chatbot
  // For now, we'll return a simple response
  res.json({
    session_id,
    response: "I understand you want to " + message + ". How can I assist you further?"
  });
});

// Doctor login endpoint
app.post('/api/doctor/login', (req, res) => {
  const { doctorId, password } = req.body;
  
  // Read doctors data
  const doctorsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../doctor.json'), 'utf8'));
  
  // Find doctor with matching ID and password
  const doctor = doctorsData.doctors.find(
    (doc) => doc.id === doctorId && doc.password === password
  );
  
  if (!doctor) {
    return res.json({
      success: false,
      message: 'Invalid credentials'
    });
  }
  
  // Get appointments for this doctor
  // In a real app, this would come from a database
  // For now, we'll return mock appointments
  const mockAppointments = [
    {
      id: 1,
      patientName: 'John Doe',
      date: '2024-03-20',
      time: '10:00',
      reason: 'Regular checkup',
      status: 'confirmed'
    },
    {
      id: 2,
      patientName: 'Jane Smith',
      date: '2024-03-20',
      time: '11:00',
      reason: 'Follow-up',
      status: 'pending'
    }
  ];
  
  // Remove password from doctor data before sending
  const { password: _, ...doctorWithoutPassword } = doctor;
  
  res.json({
    success: true,
    doctor: doctorWithoutPassword,
    appointments: mockAppointments
  });
});

// Use email routes
app.use('/api', emailRoutes);

// Test route to check if server is running
app.get('/', (req, res) => {
  res.send('Email service is running!');
});

app.listen(port, () => {
  console.log(`Healthcare API server running on port ${port}`);
}); 