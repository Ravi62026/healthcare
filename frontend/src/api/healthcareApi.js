// Healthcare API Service

const API_BASE_URL = 'http://localhost:5000';

// Helper function for API calls
const apiCall = async (endpoint, method = 'GET', data = null) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  const config = {
    method,
    headers,
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
};

// Helper function for file uploads
const uploadFile = async (endpoint, formData) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      body: formData, // No Content-Type header needed for FormData
    });
    
    if (!response.ok) {
      throw new Error(`File upload failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
};

// Healthcare API endpoints
const healthcareApi = {
  // Get welcome message and session ID
  getWelcomeMessage: () => {
    return apiCall('/api/welcome');
  },

  // Send a message to the chatbot
  sendMessage: (message, sessionId) => {
    return apiCall('/api/chat', 'POST', { message, session_id: sessionId });
  },

  // Book an appointment directly
  bookAppointment: (appointmentData) => {
    return apiCall('/api/book-appointment', 'POST', appointmentData);
  },

  // Check an existing appointment
  checkAppointment: (identifier) => {
    return apiCall('/api/check-appointment', 'POST', identifier);
  },

  // Cancel an appointment
  cancelAppointment: (identifier) => {
    return apiCall('/api/cancel-appointment', 'POST', identifier);
  },

  // Get available doctors
  getDoctors: () => {
    return apiCall('/api/doctors');
  },

  // Get available appointment slots
  getAvailableSlots: () => {
    return apiCall('/api/available-slots');
  },

  // Check symptoms
  checkSymptoms: (symptoms) => {
    return apiCall('/api/check-symptoms', 'POST', { symptoms });
  },

  // Upload medical history file for an appointment
  uploadMedicalHistory: (data) => {
    return apiCall('/api/upload-medical-history', 'POST', data);
  },
  
  // Upload medical history file using FormData (for chat flow)
  uploadMedicalHistoryFile: (sessionId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    if (sessionId) {
      formData.append('session_id', sessionId);
    }
    return uploadFile('/api/upload-medical-history', formData);
  },

  // Get a medical history file
  getMedicalHistoryFile: (filename) => {
    return apiCall(`/api/medical-history-file/${filename}`);
  },
  
  // Doctor login
  doctorLogin: (credentials) => {
    return apiCall('/api/doctor/login', 'POST', credentials);
  },
  
  // Get doctor's appointments
  getDoctorAppointments: (doctorId) => {
    return apiCall('/api/doctor/appointments', 'POST', { doctor_id: doctorId });
  },
  
  // Send email
  sendEmail: (emailData) => {
    return apiCall('/api/send-email', 'POST', emailData);
  },
};

export default healthcareApi; 