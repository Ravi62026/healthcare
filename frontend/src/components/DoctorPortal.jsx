import React, { useState, useEffect } from 'react';

const DoctorPortal = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [doctorId, setDoctorId] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [password, setPassword] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailAttachment, setEmailAttachment] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');

  // API base URL - update this to match your Flask server
  const API_BASE_URL = 'http://localhost:5000';

  // Function to handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/doctor/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          doctor_id: doctorId, 
          password: password 
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setIsLoggedIn(true);
        setDoctorName(data.doctor.name);
        setSpecialty(data.doctor.specialty || '');
        fetchAppointments(doctorId);
      } else {
        setError(data.message || 'Invalid credentials');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Function to fetch appointments
  const fetchAppointments = async (id) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/doctor/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          doctor_id: id
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setAppointments(data.appointments || []);
      } else {
        setError(data.message || 'Failed to fetch appointments');
      }
    } catch (err) {
      setError('Error fetching appointments');
      console.error('Fetch appointments error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle appointment selection and view details
  const handleAppointmentClick = (appointment) => {
    setSelectedAppointment(appointment);
  };

  // Function to close appointment details
  const closeAppointmentDetails = () => {
    setSelectedAppointment(null);
  };

  // Function to open cancel modal
  const openCancelModal = (e) => {
    e.stopPropagation();
    setShowCancelModal(true);
  };

  // Function to close the cancel appointment modal
  const closeCancelModal = () => {
    setShowCancelModal(false);
    setCancelReason('');
  };

  // Function to download medical history file
  const handleDownloadFile = async (filename) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/medical-history-file/${filename}`);
      const data = await response.json();
      
      if (data.success) {
        // Create blob from base64
        const byteCharacters = atob(data.file_content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray]);
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 0);
      } else {
        setError('Error downloading file: ' + data.message);
      }
    } catch (err) {
      setError('Error downloading file');
      console.error('Download error:', err);
    }
  };

  // Function to cancel an appointment
  const handleCancelAppointment = async () => {
    setCancelling(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/cancel-appointment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointment_id: selectedAppointment.id,
          reason: cancelReason
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Appointment cancelled successfully');
        setError('');
        closeCancelModal();
        fetchAppointments();
        closeAppointmentDetails();
      } else {
        setError(data.message || 'Failed to cancel appointment');
        setSuccess('');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setSuccess('');
    } finally {
      setCancelling(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setDoctorId('');
    setPassword('');
    setDoctorName('');
    setSpecialty('');
    setAppointments([]);
    setSelectedAppointment(null);
  };

  // Function to open the email modal
  const openEmailModal = (e) => {
    if (e) e.stopPropagation();
    // Pre-populate the subject with patient name and appointment date
    if (selectedAppointment) {
      setEmailSubject(`Regarding your appointment on ${selectedAppointment.appointment_date}`);
    }
    setShowEmailModal(true);
  };

  // Function to close the email modal
  const closeEmailModal = () => {
    setShowEmailModal(false);
    setEmailSubject('');
    setEmailBody('');
    setEmailAttachment(null);
    setEmailSuccess('');
  };

  // Function to handle file selection for email attachment
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File is too large. Maximum size allowed is 5MB.');
        return;
      }
      setEmailAttachment(file);
    }
  };

  // Function to send email to patient
  const sendEmailToPatient = async () => {
    if (!selectedAppointment || !selectedAppointment.email) {
      setError('Patient email address is missing');
      return;
    }

    if (!emailSubject || !emailBody) {
      setError('Please provide both subject and message body');
      return;
    }

    setSendingEmail(true);
    setError('');
    
    try {
      // Create FormData to send file
      const formData = new FormData();
      formData.append('recipient', selectedAppointment.email);
      formData.append('subject', emailSubject);
      formData.append('message', emailBody);
      formData.append('patientName', selectedAppointment.name);
      formData.append('doctorName', doctorName);
      
      if (emailAttachment) {
        formData.append('attachment', emailAttachment);
      }

      const response = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setEmailSuccess('Email sent successfully to ' + selectedAppointment.email);
        setTimeout(() => {
          closeEmailModal();
        }, 3000);
      } else {
        setError(data.message || 'Failed to send email');
      }
    } catch (err) {
      console.error('Error sending email:', err);
      setError('Error sending email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-center mb-8">Doctor Portal</h1>
      
      {!isLoggedIn ? (
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-semibold mb-4">Login</h2>
          
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
              <p>{error}</p>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="doctorId" className="block text-sm font-medium text-gray-700">
                Doctor ID
              </label>
              <input
                type="text"
                id="doctorId"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold">Dr. {doctorName}'s Appointments</h2>
              {specialty && <p className="text-gray-600">{specialty}</p>}
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Logout
            </button>
          </div>
          
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
              <p>{error}</p>
            </div>
          )}
          
          {success && (
            <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" role="alert">
              <p>{success}</p>
            </div>
          )}
          
          {loading ? (
            <div className="flex justify-center py-8">
              <svg className="animate-spin h-8 w-8 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : selectedAppointment ? (
            <div className="bg-white rounded-lg shadow">
              {/* Appointment Detail View */}
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Appointment Details
                  </h3>
                  <button
                    onClick={closeAppointmentDetails}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Patient Information */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-lg mb-3 text-gray-900">Patient Information</h4>
                    <div className="space-y-2">
                      <div className="flex">
                        <span className="w-1/3 text-gray-500">Name:</span>
                        <span className="w-2/3 font-medium">{selectedAppointment.name}</span>
                      </div>
                      <div className="flex">
                        <span className="w-1/3 text-gray-500">Email:</span>
                        <span className="w-2/3">{selectedAppointment.email}</span>
                      </div>
                      <div className="flex">
                        <span className="w-1/3 text-gray-500">Phone:</span>
                        <span className="w-2/3">{selectedAppointment.phone}</span>
                      </div>
                      <div className="flex">
                        <span className="w-1/3 text-gray-500">Age:</span>
                        <span className="w-2/3">{selectedAppointment.age}</span>
                      </div>
                      <div className="flex">
                        <span className="w-1/3 text-gray-500">Gender:</span>
                        <span className="w-2/3">{selectedAppointment.gender}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Appointment Information */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-lg mb-3 text-gray-900">Appointment Information</h4>
                    <div className="space-y-2">
                      <div className="flex">
                        <span className="w-1/3 text-gray-500">Date:</span>
                        <span className="w-2/3 font-medium">{selectedAppointment.appointment_date}</span>
                      </div>
                      <div className="flex">
                        <span className="w-1/3 text-gray-500">Time:</span>
                        <span className="w-2/3 font-medium">{selectedAppointment.appointment_time}</span>
                      </div>
                      <div className="flex">
                        <span className="w-1/3 text-gray-500">Doctor:</span>
                        <span className="w-2/3">{selectedAppointment.doctor}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Reason for Visit */}
                <div className="mt-4 bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-lg mb-2 text-gray-900">Reason for Visit</h4>
                  <p className="text-gray-800">{selectedAppointment.reason}</p>
                </div>
                
                {/* Medical History File */}
                {selectedAppointment.has_medical_history && (
                  <div className="mt-4 bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-lg mb-2 text-gray-900">Medical History File</h4>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                        <span>{selectedAppointment.medical_history_filename}</span>
                      </div>
                      <button
                        onClick={() => handleDownloadFile(selectedAppointment.medical_history_filename)}
                        className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="mt-6 flex justify-end space-x-4">
                  <button
                    onClick={openEmailModal}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      Email Patient
                    </div>
                  </button>
                  <button
                    onClick={openCancelModal}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Cancel Appointment
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {appointments.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <p className="text-gray-500">No appointments found.</p>
                  <p className="text-sm text-gray-400 mt-1">Appointments will appear here when patients book with you.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg shadow">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Patient Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reason
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Medical History
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {appointments.map((appointment, index) => (
                        <tr 
                          key={index} 
                          onClick={() => handleAppointmentClick(appointment)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{appointment.name}</div>
                            <div className="text-xs text-gray-500">{appointment.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {appointment.appointment_date}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {appointment.appointment_time}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                            {appointment.reason}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {appointment.has_medical_history ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Available
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                None
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          
          {/* Cancel Appointment Modal */}
          {showCancelModal && selectedAppointment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md mx-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Cancel Appointment</h3>
                <p className="text-gray-600 mb-4">
                  Are you sure you want to cancel the appointment for {selectedAppointment.name} on {selectedAppointment.appointment_date} at {selectedAppointment.appointment_time}?
                </p>
                
                <div className="mb-4">
                  <label htmlFor="cancelReason" className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for cancellation (optional):
                  </label>
                  <textarea
                    id="cancelReason"
                    rows="3"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    placeholder="Enter reason for cancellation"
                  ></textarea>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={closeCancelModal}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={cancelling}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCancelAppointment}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300"
                    disabled={cancelling}
                  >
                    {cancelling ? 'Processing...' : 'Confirm Cancellation'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email Patient Modal */}
          {showEmailModal && selectedAppointment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg mx-4">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-medium text-gray-900">Send Email to Patient</h3>
                  <button
                    onClick={closeEmailModal}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {emailSuccess && (
                  <div className="mb-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4">
                    <p>{emailSuccess}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <p className="text-gray-600 mb-1">
                      Sending email to: <span className="font-medium">{selectedAppointment.email}</span>
                    </p>
                  </div>

                  <div>
                    <label htmlFor="emailSubject" className="block text-sm font-medium text-gray-700 mb-1">
                      Subject:
                    </label>
                    <input
                      type="text"
                      id="emailSubject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Email subject"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="emailBody" className="block text-sm font-medium text-gray-700 mb-1">
                      Message:
                    </label>
                    <textarea
                      id="emailBody"
                      rows="6"
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Write your message here..."
                      required
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Attachment (optional):
                    </label>
                    {emailAttachment ? (
                      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md border border-gray-200">
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-gray-700 truncate">{emailAttachment.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEmailAttachment(null)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center w-full px-4 py-2 border border-gray-300 border-dashed rounded-md hover:bg-gray-50 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-500">Click to attach a file</span>
                        <input 
                          type="file" 
                          className="hidden" 
                          onChange={handleFileChange}
                          disabled={sendingEmail}
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={sendEmailToPatient}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center"
                      disabled={sendingEmail || !emailSubject || !emailBody}
                    >
                      {sendingEmail ? (
                        <>
                          <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                          </svg>
                          Send Email
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DoctorPortal;