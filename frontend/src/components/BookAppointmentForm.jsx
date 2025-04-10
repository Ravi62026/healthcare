import React, { useState, useEffect } from 'react';
import healthcareApi from '../api/healthcareApi';
import FileUploadField from './FileUploadField';

const BookAppointmentForm = ({ onSuccess, initialData = {} }) => {
  const [formData, setFormData] = useState({
    name: initialData.name || '',
    email: initialData.email || '',
    phone: initialData.phone || '',
    age: initialData.age || '',
    gender: initialData.gender || '',
    reason: initialData.reason || '',
    doctor: initialData.doctor || '',
    appointment_date: initialData.appointment_date || '',
    appointment_time: initialData.appointment_time || ''
  });
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [availableSlots, setAvailableSlots] = useState({});
  const [selectedDate, setSelectedDate] = useState('');
  const [availableTimes, setAvailableTimes] = useState([]);
  
  // Fetch doctors and available slots
  useEffect(() => {
    const fetchData = async () => {
      try {
        const doctorsResponse = await healthcareApi.getDoctors();
        setDoctors(doctorsResponse.doctors || {});
        
        const slotsResponse = await healthcareApi.getAvailableSlots();
        setAvailableSlots(slotsResponse.available_slots || {});
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load doctors and available slots');
      }
    };
    
    fetchData();
  }, []);
  
  // Update available times when date changes
  useEffect(() => {
    if (selectedDate && availableSlots[selectedDate]) {
      setAvailableTimes(availableSlots[selectedDate]);
    } else {
      setAvailableTimes([]);
    }
  }, [selectedDate, availableSlots]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'appointment_date') {
      setSelectedDate(value);
      setFormData(prev => ({ ...prev, appointment_time: '' }));
    }
  };
  
  const handleFileSelected = (file) => {
    setSelectedFile(file);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Basic validation
    const requiredFields = ['name', 'email', 'phone', 'doctor', 'appointment_date', 'appointment_time'];
    for (const field of requiredFields) {
      if (!formData[field]) {
        setError(`Please fill in the ${field.replace('_', ' ')}`);
        return;
      }
    }
    
    // Validate medical history file is uploaded
    if (!selectedFile) {
      setError('Please upload your medical history file');
      return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    // Phone validation
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(formData.phone)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    
    try {
      setLoading(true);
      
      let appointmentData = { ...formData };
      
      // If a file was selected, prepare it for upload
      if (selectedFile) {
        // Read file as base64
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => {
            const base64Content = reader.result.split(',')[1];
            resolve(base64Content);
          };
          reader.onerror = reject;
        });
        
        const base64Content = await base64Promise;
        
        // Add file data to appointment
        appointmentData.medical_history_file = {
          file_name: selectedFile.name,
          file_content: base64Content
        };
      }
      
      // Book the appointment
      const response = await healthcareApi.bookAppointment(appointmentData);
      
      if (response.success) {
        if (onSuccess) {
          onSuccess(response.appointment);
        }
      } else {
        setError(response.message || 'Failed to book appointment');
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      setError('An error occurred while booking your appointment');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6 text-center text-red-600">Book an Appointment</h2>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Personal Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Personal Information</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number * (10 digits)
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                required
                pattern="\d{10}"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age
              </label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                min="0"
                max="120"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Visit *
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              rows="3"
              required
            ></textarea>
          </div>
          
          {/* Medical History File Upload */}
          <FileUploadField onFileSelected={handleFileSelected} disabled={loading} />
        </div>
        
        {/* Appointment Details */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h3 className="text-lg font-semibold">Appointment Details</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Doctor *
            </label>
            <select
              name="doctor"
              value={formData.doctor}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            >
              <option value="">Select a Doctor</option>
              {Object.entries(doctors).map(([id, name]) => (
                <option key={id} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Appointment Date *
              </label>
              <select
                name="appointment_date"
                value={formData.appointment_date}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              >
                <option value="">Select a Date</option>
                {Object.keys(availableSlots).map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Appointment Time *
              </label>
              <select
                name="appointment_time"
                value={formData.appointment_time}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                required
                disabled={!selectedDate}
              >
                <option value="">Select a Time</option>
                {availableTimes.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-md text-white font-medium text-lg ${
              loading ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading ? 'Booking...' : 'Book Appointment'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BookAppointmentForm; 