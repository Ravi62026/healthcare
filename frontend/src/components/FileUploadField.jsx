import React, { useState } from 'react';

const FileUploadField = ({ onFileSelected, disabled = false }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    
    if (!selectedFile) {
      return;
    }
    
    // Validate file type
    const validTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const fileExtension = '.' + selectedFile.name.split('.').pop().toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      setError('Please select a valid file type (PDF, DOC, DOCX, JPG, JPEG, PNG)');
      return;
    }
    
    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File is too large. Maximum size is 5MB');
      return;
    }
    
    setFile(selectedFile);
    setError('');
    
    // Create preview for image files
    if (['jpg', 'jpeg', 'png'].includes(fileExtension.slice(1))) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      // For non-image files, just show the filename
      setPreview(null);
    }
    
    // Notify parent component
    if (onFileSelected) {
      onFileSelected(selectedFile);
    }
  };
  
  const removeFile = () => {
    setFile(null);
    setPreview(null);
    
    // Notify parent component
    if (onFileSelected) {
      onFileSelected(null);
    }
  };
  
  return (
    <div className="mt-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Medical History File *
      </label>
      
      {error && (
        <div className="text-red-600 text-sm mb-2">
          {error}
        </div>
      )}
      
      {!file ? (
        <div className="flex items-center justify-center w-full">
          <label className={`flex flex-col w-full h-32 border-2 border-dashed rounded-lg ${disabled ? 'border-gray-300 bg-gray-100' : 'border-red-300 hover:bg-red-50 hover:border-red-500'} transition-all duration-300`}>
            <div className="flex flex-col items-center justify-center pt-7">
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${disabled ? 'text-gray-400' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className={`pt-1 text-sm tracking-wider ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
                {disabled ? 'File upload disabled' : 'Upload medical history file'}
              </p>
              <p className="text-xs text-gray-500">
                PDF, DOC, DOCX, JPG, JPEG, PNG (Max 5MB)
              </p>
            </div>
            <input 
              type="file" 
              className="hidden" 
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              disabled={disabled}
              required
            />
          </label>
        </div>
      ) : (
        <div className="border rounded-lg p-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
              </svg>
              <div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button 
              onClick={removeFile}
              className="text-gray-400 hover:text-red-600"
              type="button"
              disabled={disabled}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {preview && (
            <div className="mt-2">
              <img src={preview} alt="Preview" className="max-h-32 rounded-lg mx-auto border" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUploadField; 