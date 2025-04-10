import React, { useState } from 'react';
import healthcareApi from '../api/healthcareApi';
import AppointmentDetails from './AppointmentDetails';

const AppointmentChecker = () => {
  const [identifier, setIdentifier] = useState('');
  const [identifierType, setIdentifierType] = useState('email');
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  
  const handleIdentifierChange = (e) => {
    setIdentifier(e.target.value);
  };
  
  const handleTypeChange = (e) => {
    setIdentifierType(e.target.value);
  };
  
  const checkAppointment = async (e) => {
    e.preventDefault();
    
    if (!identifier) {
      setError('Please enter your email or phone number');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setMessage('');
      setAppointments([]);
      setSelectedAppointment(null);
      
      // Create the payload based on identifier type
      const payload = identifierType === 'email' 
        ? { email: identifier } 
        : { phone: identifier };
      
      const response = await healthcareApi.checkAppointment(payload);
      
      if (response.found) {
        if (response.appointment_count > 1 && response.appointments) {
          // Multiple appointments found
          setAppointments(response.appointments);
        } else if (response.appointment) {
          // Single appointment found (backward compatibility)
          setSelectedAppointment(response.appointment);
        } else if (response.appointments && response.appointments.length === 1) {
          // Single appointment in array
          setSelectedAppointment(response.appointments[0]);
        } else {
          setError('No appointment details found in the response.');
        }
      } else {
        setError('No appointment found with the provided information.');
      }
    } catch (error) {
      console.error('Error checking appointment:', error);
      setError('An error occurred while checking your appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAppointmentSelect = (appointment) => {
    setSelectedAppointment(appointment);
  };
  
  const handleAppointmentUpdate = (updatedAppointment) => {
    // Update the selected appointment
    setSelectedAppointment(updatedAppointment);
    
    // Also update the appointment in the appointments list if it exists there
    if (appointments.length > 0) {
      setAppointments(prev => 
        prev.map(app => 
          (app.email === updatedAppointment.email || app.phone === updatedAppointment.phone) 
            ? updatedAppointment 
            : app
        )
      );
    }
  };
  
  const handleBackToList = () => {
    setSelectedAppointment(null);
  };
  
  const handleCancelClick = () => {
    setShowCancelConfirm(true);
  };
  
  const cancelAppointment = async (appointmentId = null) => {
    try {
      setLoading(true);
      setError('');
      setMessage('');
      
      // Create the payload
      let payload;
      
      if (appointmentId !== null) {
        // Cancel by ID (for multiple appointments)
        payload = { appointment_id: appointmentId };
      } else {
        // Cancel by identifier (for single appointment)
        payload = identifierType === 'email' 
          ? { email: identifier } 
          : { phone: identifier };
      }
      
      const response = await healthcareApi.cancelAppointment(payload);
      
      if (response.success) {
        setMessage(response.message);
        
        // Update the appointments list
        if (appointments.length > 0) {
          // If we have a list of appointments, remove the cancelled one
          if (appointmentId !== null) {
            setAppointments(prev => prev.filter((_, index) => index !== appointmentId));
          }
          // If we just cancelled the selected appointment, clear it
          if (selectedAppointment) {
            setSelectedAppointment(null);
          }
        } else {
          // Clear everything
          setAppointments([]);
          setSelectedAppointment(null);
        }
        
        setShowCancelConfirm(false);
      } else {
        setError(response.message || 'Failed to cancel appointment');
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      setError('An error occurred while cancelling your appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const renderAppointmentsList = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Found {appointments.length} appointments</h3>
        {appointments.map((appointment, index) => (
          <div 
            key={index} 
            className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
            onClick={() => handleAppointmentSelect(appointment)}
          >
            <div className="flex justify-between">
              <div>
                <p className="font-medium">{appointment.doctor}</p>
                <p className="text-gray-600">
                  {appointment.appointment_date} at {appointment.appointment_time}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAppointment(appointment);
                  setShowCancelConfirm(true);
                }}
                className="text-red-600 hover:text-red-800"
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">Check or Cancel Appointment</h2>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {message && (
        <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
          {message}
        </div>
      )}
      
      {!selectedAppointment && appointments.length === 0 ? (
        <form onSubmit={checkAppointment} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search by
            </label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="email"
                  checked={identifierType === 'email'}
                  onChange={handleTypeChange}
                  className="h-4 w-4 text-red-600 focus:ring-red-500"
                />
                <span className="ml-2">Email</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="phone"
                  checked={identifierType === 'phone'}
                  onChange={handleTypeChange}
                  className="h-4 w-4 text-red-600 focus:ring-red-500"
                />
                <span className="ml-2">Phone</span>
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {identifierType === 'email' ? 'Email Address' : 'Phone Number'}
            </label>
            <input
              type={identifierType === 'email' ? 'email' : 'tel'}
              value={identifier}
              onChange={handleIdentifierChange}
              placeholder={identifierType === 'email' ? 'name@example.com' : '1234567890'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 px-4 rounded-md text-white font-medium ${
                loading ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? 'Checking...' : 'Check Appointment'}
            </button>
          </div>
        </form>
      ) : appointments.length > 0 && !selectedAppointment ? (
        // Display list of appointments
        <>
          {renderAppointmentsList()}
          <div className="mt-6">
            <button
              onClick={() => {
                setAppointments([]);
                setIdentifier('');
              }}
              className="w-full py-2 px-4 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
            >
              Back to Search
            </button>
          </div>
        </>
      ) : (
        // Display single appointment details
        <div>
          <AppointmentDetails 
            appointment={selectedAppointment} 
            onUpdate={handleAppointmentUpdate} 
          />
          
          <div className="mt-6 flex space-x-4">
            {showCancelConfirm ? (
              <div className="w-full">
                <p className="text-red-600 mb-3">Are you sure you want to cancel this appointment?</p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => cancelAppointment(appointments.findIndex(a => 
                      a.appointment_date === selectedAppointment.appointment_date && 
                      a.appointment_time === selectedAppointment.appointment_time))}
                    disabled={loading}
                    className="w-1/2 py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    {loading ? 'Cancelling...' : 'Yes, Cancel'}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="w-1/2 py-2 px-4 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
                  >
                    No, Keep It
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={handleCancelClick}
                  className="w-1/2 py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Cancel Appointment
                </button>
                <button
                  onClick={appointments.length > 0 ? handleBackToList : () => {
                    setAppointments([]);
                    setSelectedAppointment(null);
                    setIdentifier('');
                  }}
                  className="w-1/2 py-2 px-4 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
                >
                  {appointments.length > 0 ? 'Back to List' : 'Back to Search'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentChecker; 