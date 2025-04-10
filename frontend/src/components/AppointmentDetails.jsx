import React, { useState } from 'react';
import { formatAppointment } from '../utils/formatters';
import healthcareApi from '../api/healthcareApi';

const AppointmentDetails = ({ appointment, onClose, onUpdate }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const formattedAppointment = formatAppointment(appointment);
  
  if (!formattedAppointment) return null;
  
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      setUploading(true);
      setUploadError('');
      setUploadSuccess('');
      
      // Read file as base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        // Extract base64 content without the data URL prefix
        const base64Content = reader.result.split(',')[1];
        
        // Create payload
        const payload = {
          appointment_identifier: formattedAppointment.email || formattedAppointment.phone,
          identifier_type: formattedAppointment.email ? 'email' : 'phone',
          file_data: {
            file_name: file.name,
            file_content: base64Content
          }
        };
        
        // Upload medical history
        const response = await healthcareApi.uploadMedicalHistory(payload);
        
        if (response.success) {
          setUploadSuccess('Medical history file uploaded successfully');
          
          // Update local appointment data with the new file info
          if (onUpdate && typeof onUpdate === 'function') {
            onUpdate({
              ...appointment,
              has_medical_history: true,
              medical_history_file_path: response.file_path,
              medical_history_filename: response.filename
            });
          }
        } else {
          setUploadError(response.message || 'Error uploading file');
        }
      };
      
      reader.onerror = () => {
        setUploadError('Error reading file');
      };
      
    } catch (error) {
      console.error('Error uploading medical history:', error);
      setUploadError('An error occurred while uploading the file');
    } finally {
      setUploading(false);
    }
  };
  
  const downloadMedicalHistoryFile = async () => {
    try {
      const response = await healthcareApi.getMedicalHistoryFile(formattedAppointment.medical_history_filename);
      
      if (response.success) {
        // Create blob from base64
        const byteCharacters = atob(response.file_content);
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
        a.download = response.filename;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 0);
      } else {
        console.error('Error downloading file:', response.message);
        alert('Error downloading file: ' + response.message);
      }
    } catch (error) {
      console.error('Error downloading medical history file:', error);
      alert('Error downloading the file');
    }
  };
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 w-full border border-gray-100">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-rose-600">Appointment Details</h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      
      <div className="border-t border-gray-100 pt-5 space-y-5">
        <div className="bg-gradient-to-r from-red-50 to-rose-50 p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <span className="text-sm text-rose-600 font-medium">Patient</span>
                <p className="font-semibold text-gray-800">{formattedAppointment.name}</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              </div>
              <div>
                <span className="text-sm text-rose-600 font-medium">Doctor</span>
                <p className="font-semibold text-gray-800">{formattedAppointment.doctor}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-sm md:col-span-2">
            <span className="text-sm text-gray-500 block mb-1">Date</span>
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <p className="font-semibold text-gray-800">{formattedAppointment.formattedDate}</p>
            </div>
          </div>
          
          <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-sm md:col-span-2">
            <span className="text-sm text-gray-500 block mb-1">Time</span>
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <p className="font-semibold text-gray-800">{formattedAppointment.formattedTime}</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Email</span>
            <div className="flex items-center mt-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <p className="text-gray-700 truncate">{formattedAppointment.email}</p>
            </div>
          </div>
          
          <div>
            <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Phone</span>
            <div className="flex items-center mt-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              <p className="text-gray-700">{formattedAppointment.phone}</p>
            </div>
          </div>
        </div>
        
        <div>
          <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Reason for Visit</span>
          <div className="mt-1 p-3 bg-gray-50 rounded-lg text-gray-700 border border-gray-100">
            {formattedAppointment.reason}
          </div>
        </div>
        
        {/* Medical History Section */}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <h3 className="text-md font-medium mb-2">Medical History</h3>
          
          {uploadError && (
            <div className="bg-red-100 text-red-700 p-3 rounded mb-3 text-sm">
              {uploadError}
            </div>
          )}
          
          {uploadSuccess && (
            <div className="bg-green-100 text-green-700 p-3 rounded mb-3 text-sm">
              {uploadSuccess}
            </div>
          )}
          
          {formattedAppointment.has_medical_history ? (
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700">{formattedAppointment.medical_history_filename}</span>
              </div>
              <button 
                onClick={downloadMedicalHistoryFile}
                className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download
              </button>
            </div>
          ) : (
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800 mb-2">No medical history file uploaded yet.</p>
              <label className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium cursor-pointer inline-block">
                Upload Medical History
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  disabled={uploading}
                />
              </label>
              {uploading && <span className="ml-2 text-sm text-gray-500">Uploading...</span>}
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-6 bg-gradient-to-r from-red-50 via-rose-50 to-red-50 p-4 rounded-lg border border-red-100">
        <div className="flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-red-800">
            <p className="font-medium mb-1">Important Information</p>
            <p>Please arrive 15 minutes prior to your appointment time.</p>
            <p>If you need to reschedule, please contact us at least 24 hours in advance.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetails; 