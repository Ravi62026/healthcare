import React, { useState, useEffect, useRef, useContext } from 'react';
import { ethers } from 'ethers';
import { DEPLOY_ADDRESS, ABI } from '../../context/constant';
import healthcareApi from '../api/healthcareApi';
import { AppointmentContext } from '../App';
import ReactMarkdown from 'react-markdown';
import BookAppointmentForm from './BookAppointmentForm';

// Map spoken options to their corresponding numbers
const SPEECH_OPTIONS_MAP = {
  'book an appointment': '1',
  'book appointment': '1',
  'make an appointment': '1',
  'schedule appointment': '1',
  
  'check my appointment': '2',
  'check appointment': '2',
  'existing appointment': '2',
  'view appointment': '2',
  
  'cancel my appointment': '3',
  'cancel appointment': '3',
  'delete appointment': '3',
  
  'view available doctors': '4',
  'available doctors': '4',
  'show doctors': '4',
  'list doctors': '4',
  
  'check symptoms': '5',
  'check my symptoms': '5',
  'symptom check': '5',
  'health check': '5'
};

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [blockchainLoading, setBlockchainLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showManualBookingForm, setShowManualBookingForm] = useState(false);
  const [awaitingManualBookingResponse, setAwaitingManualBookingResponse] = useState(false);
  const messageEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Use the shared context
  const { 
    connectWallet, 
    bookAppointmentOnBlockchain, 
    isConnected, 
    account, 
    setLastBookedAppointment 
  } = useContext(AppointmentContext);

  // Initialize speech recognition
  useEffect(() => {
    // Check if browser supports speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported by this browser');
      return;
    }

    // Create speech recognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    // Configure speech recognition
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'en-US';
    
    // Handle speech recognition results
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim().toLowerCase();
      console.log('Speech recognized:', transcript);
      
      // Check if the spoken text matches any of our mapped options
      let numberToSend = null;
      
      // First try direct mapping
      if (SPEECH_OPTIONS_MAP[transcript]) {
        numberToSend = SPEECH_OPTIONS_MAP[transcript];
      } else {
        // Try to find partial matches
        for (const [phrase, number] of Object.entries(SPEECH_OPTIONS_MAP)) {
          if (transcript.includes(phrase)) {
            numberToSend = number;
            break;
          }
        }
      }
      
      if (numberToSend) {
        setInput(numberToSend);
        // Small delay to show the user what was recognized
        setTimeout(() => {
          handleSendMessage(new Event('submit', { cancelable: true }), numberToSend);
        }, 500);
      } else {
        // If no option matched, just set the input to what was spoken
        setInput(transcript);
      }
      
      setListening(false);
    };
    
    recognitionRef.current.onend = () => {
      setListening(false);
    };
    
    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setListening(false);
    };
    
    return () => {
      // Cleanup
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      }
    };
  }, []);
  
  // Start/stop speech recognition
  const toggleSpeechRecognition = () => {
    if (listening) {
      recognitionRef.current?.abort();
      setListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setListening(true);
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }
    }
  };

  // Get welcome message on component mount
  useEffect(() => {
    const fetchWelcomeMessage = async () => {
      try {
        setLoading(true);
        const response = await healthcareApi.getWelcomeMessage();
        setSessionId(response.session_id);
        setMessages([{ 
          text: response.response, 
          sender: 'bot' 
        }]);
      } catch (error) {
        console.error('Error fetching welcome message:', error);
        setMessages([{ 
          text: 'Sorry, I had trouble connecting. Please try again.', 
          sender: 'bot' 
        }]);
      } finally {
        setLoading(false);
      }
    };

    fetchWelcomeMessage();
  }, []);

  // Scroll to bottom of messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addBotMessage = (text) => {
    setMessages(prevMessages => [
      ...prevMessages, 
      { text, sender: 'bot' }
    ]);
  };

  // Check if a message contains appointment confirmation
  const isAppointmentConfirmation = (text) => {
    return text.includes("APPOINTMENT CONFIRMED") || 
           text.includes("appointment has been booked") ||
           (text.includes("appointment") && text.includes("confirmed"));
  };

  // Extract appointment details from confirmation message
  const extractAppointmentDetails = (text) => {
    // Enhanced extraction with improved regex for emails
    const extractField = (field) => {
      const regex = new RegExp(`${field}:\\s*([^\\n]+)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : '';
    };

    // Special case for email to preserve @ and other special characters
    const extractEmail = () => {
      // Try standard email format first (directly matching email pattern)
      const standardEmailRegex = /Email:\s*([\w.+-]+@[\w.-]+\.\w+)/i;
      const standardMatch = text.match(standardEmailRegex);
      if (standardMatch) return standardMatch[1].trim();
      
      // Try to find email written as "at the rate" or similar
      const textBasedEmailRegex = /Email:\s*([\w.+-]+)\s*(?:at the rate|at|at symbol)\s*([\w.-]+\.\w+)/i;
      const textMatch = text.match(textBasedEmailRegex);
      if (textMatch) return `${textMatch[1]}@${textMatch[2]}`.trim();
      
      // Try to find email with the @ symbol possibly separated by spaces
      const spacedEmailRegex = /Email:\s*([\w.+-]+)\s*@\s*([\w.-]+\.\w+)/i;
      const spacedMatch = text.match(spacedEmailRegex);
      if (spacedMatch) return `${spacedMatch[1]}@${spacedMatch[2]}`.trim();
      
      // Fallback to general extraction and try to detect email pattern
      const generalExtraction = extractField('Email');
      if (generalExtraction) {
        // Replace common text substitutions for @ with the actual symbol
        return generalExtraction
          .replace(/\s*(?:at the rate|at symbol|at)\s*/i, '@')
          .trim()
          .replace(/\s+/g, ''); // Remove any extra spaces
      }
      
      return '';
    };

    return {
      name: extractField('Name'),
      email: extractEmail(), // Use specialized email extraction
      phone: extractField('Phone'),
      age: extractField('Age'),
      gender: extractField('Gender'),
      doctor: extractField('Doctor'),
      appointment_date: extractField('Date'),
      appointment_time: extractField('Time'),
      reason: extractField('Reason')
    };
  };

  // Record appointment on blockchain using context
  const recordOnBlockchain = async (appointmentData) => {
    try {
      setBlockchainLoading(true);
      addBotMessage("Processing your appointment on blockchain...");
      
      // Connect wallet if not connected
      if (!isConnected) {
        await connectWallet();
      }
      
      // Book the appointment using shared context method
      const result = await bookAppointmentOnBlockchain(appointmentData);
      
      if (result.success) {
        addBotMessage(`Your appointment has been successfully recorded on the blockchain! Transaction hash: ${result.transaction.hash.slice(0, 10)}...${result.transaction.hash.slice(-6)}`);
        
        // Store the appointment in the shared context
        setLastBookedAppointment(appointmentData);
      } else {
        addBotMessage(`Error: ${result.error || 'Failed to record on blockchain'}. Your appointment is still booked in our system.`);
      }
    } catch (error) {
      console.error("Error booking appointment on blockchain:", error);
      addBotMessage("There was an error recording your appointment on the blockchain. Your appointment is still booked in our system.");
    } finally {
      setBlockchainLoading(false);
    }
  };

  const handleSendMessage = async (e, overrideInput = null) => {
    e.preventDefault();
    const messageToSend = overrideInput || input;
    
    if (!messageToSend.trim() || loading) return;

    // Add user message to chat
    const userMessage = { text: messageToSend, sender: 'user' };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Send message to API
      const response = await healthcareApi.sendMessage(messageToSend, sessionId);
      
      // Update session ID if provided
      if (response.session_id) {
        setSessionId(response.session_id);
      }
      
      // Add bot response to chat
      const botResponseText = response.response;
      setMessages(prevMessages => [
        ...prevMessages, 
        { text: botResponseText, sender: 'bot' }
      ]);
      
      // Check if this is an appointment confirmation message
      if (isAppointmentConfirmation(botResponseText)) {
        // Extract appointment details from the response
        const appointmentData = extractAppointmentDetails(botResponseText);
        
        // If we have at least the basic required fields, offer blockchain booking
        if (appointmentData.name && appointmentData.appointment_date && appointmentData.appointment_time) {
          // Wait a moment before adding the blockchain option
          setTimeout(() => {
            setMessages(prevMessages => [
              ...prevMessages, 
              { 
                text: "Would you like to record this appointment on the blockchain for additional security? (yes/no)", 
                sender: 'bot' 
              }
            ]);
            
            // Set a flag to track that we're waiting for blockchain confirmation
            sessionStorage.setItem('pendingBlockchainAppointment', JSON.stringify(appointmentData));
          }, 1000);
        }
      }
      
      // Still check for direct appointment data in response (fallback)
      else if (response.appointment) {
        const appointment = response.appointment;
        
        // Wait a moment before adding the blockchain option
        setTimeout(() => {
          setMessages(prevMessages => [
            ...prevMessages, 
            { 
              text: "Would you like to record this appointment on the blockchain for additional security? (yes/no)", 
              sender: 'bot' 
            }
          ]);
          
          // Set a flag to track that we're waiting for blockchain confirmation
          sessionStorage.setItem('pendingBlockchainAppointment', JSON.stringify(appointment));
        }, 1000);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prevMessages => [
        ...prevMessages, 
        { text: 'Sorry, I encountered an error. Please try again.', sender: 'bot' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for user confirmation to use blockchain
    const checkForBlockchainConfirmation = () => {
      const pendingAppointment = sessionStorage.getItem('pendingBlockchainAppointment');
      if (!pendingAppointment) return;
      
      const lastUserMessage = messages.filter(m => m.sender === 'user').pop();
      if (!lastUserMessage) return;
      
      const response = lastUserMessage.text.toLowerCase();
      
      if (response.includes('yes') || response === 'y') {
        // User wants to record on blockchain
        const appointmentData = JSON.parse(pendingAppointment);
        sessionStorage.removeItem('pendingBlockchainAppointment');
        recordOnBlockchain(appointmentData);
      } else if (response.includes('no') || response === 'n') {
        // User doesn't want to record on blockchain
        sessionStorage.removeItem('pendingBlockchainAppointment');
        addBotMessage("That's fine. Your appointment has been booked in our system without blockchain verification.");
      }
    };
    
    checkForBlockchainConfirmation();
  }, [messages]);

  // Handle option click
  const handleOptionClick = (option) => {
    // If option is 1 (book appointment), ask if they want to book manually
    if (option === "1") {
      setAwaitingManualBookingResponse(true);
      setMessages(prevMessages => [
        ...prevMessages,
        { text: "1", sender: 'user' },
        { 
          text: "Would you like to book your appointment manually using a form? (yes/no)", 
          sender: 'bot' 
        }
      ]);
      return;
    }
    
    // For other options, proceed normally
    setInput(option);
    handleSendMessage(new Event('submit', { cancelable: true }), option);
  };
  
  // Handle manual booking response
  useEffect(() => {
    // Check if we're waiting for a response to the manual booking question
    if (!awaitingManualBookingResponse) return;
    
    const lastUserMessage = messages.filter(m => m.sender === 'user').pop();
    if (!lastUserMessage) return;
    
    // Skip if the last message was the "1" option itself
    if (lastUserMessage.text === "1") return;
    
    const response = lastUserMessage.text.toLowerCase();
    
    if (response.includes('yes') || response === 'y') {
      // User wants to book manually
      setAwaitingManualBookingResponse(false);
      setShowManualBookingForm(true);
    } else if (response.includes('no') || response === 'n') {
      // User wants to continue with chatbot-guided booking
      setAwaitingManualBookingResponse(false);
      // Proceed with regular booking flow
      handleSendMessage(new Event('submit', { cancelable: true }), "1");
    }
    
  }, [messages, awaitingManualBookingResponse]);

  // Handle successful manual booking
  const handleManualBookingSuccess = (appointmentData) => {
    setShowManualBookingForm(false);
    
    // Add confirmation message to the chat
    const confirmationMessage = `✅ APPOINTMENT CONFIRMED ✅\n\n` +
      `Name: ${appointmentData.name}\n` +
      `Email: ${appointmentData.email}\n` +
      `Phone: ${appointmentData.phone}\n` +
      `Doctor: ${appointmentData.doctor}\n` +
      `Date: ${appointmentData.appointment_date}\n` +
      `Time: ${appointmentData.appointment_time}\n` +
      `Reason: ${appointmentData.reason}\n\n` +
      `Your appointment has been booked successfully.\n\n` +
      `Would you like to record this appointment on the blockchain for additional security? (yes/no)`;
    
    setMessages(prevMessages => [
      ...prevMessages,
      { text: confirmationMessage, sender: 'bot' }
    ]);
    
    // Set a flag to track that we're waiting for blockchain confirmation
    sessionStorage.setItem('pendingBlockchainAppointment', JSON.stringify(appointmentData));
  };

  // Handle doctor selection click
  const handleDoctorClick = (doctorId, doctorDisplayName) => {
    // Store the doctor ID in sessionStorage so we can reference it later
    sessionStorage.setItem('selectedDoctorId', doctorId);
    
    // Set the display name in the input field for user to see
    setInput(doctorDisplayName);
    
    // Add a message from the user showing their selection
    setMessages(prevMessages => [
      ...prevMessages,
      { text: doctorDisplayName, sender: 'user' }
    ]);
    
    // Send a special formatted message that includes the doctor ID
    const formattedMessage = `DOCTOR_ID:${doctorId}:${doctorDisplayName}`;
    
    // Set loading state
    setLoading(true);
    
    // Call the API with the formatted message
    healthcareApi.sendMessage(formattedMessage, sessionId)
      .then(response => {
        // Update session ID if provided
        if (response.session_id) {
          setSessionId(response.session_id);
        }
        
        // Add bot response to chat
        setMessages(prevMessages => [
          ...prevMessages,
          { text: response.response, sender: 'bot' }
        ]);
      })
      .catch(error => {
        console.error('Error sending doctor selection:', error);
        setMessages(prevMessages => [
          ...prevMessages,
          { text: 'Sorry, I encountered an error selecting the doctor. Please try again.', sender: 'bot' }
        ]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Handle date selection click
  const handleDateClick = (date) => {
    setInput(date);
    handleSendMessage(new Event('submit', { cancelable: true }), date);
  };

  // Handle time slot click
  const handleTimeClick = (time) => {
    setInput(time);
    handleSendMessage(new Event('submit', { cancelable: true }), time);
  };

  // Format doctor list with enhanced UI
  const formatDoctorList = (text) => {
    if (text.includes('Here are our available doctors:')) {
      try {
        // Parse the message text to extract doctor information
        // Example format: "1. Dr. John Smith (Cardiologist)"
        const doctorList = text.match(/\d+\.\s+Dr\.\s+[^(]+\([^)]+\)/g) || [];
        
        // Parse the doctor list to get all doctor IDs
        const doctorIds = {};
        try {
          // Look for doctor IDs in the text
          const idMatches = text.match(/Doctor IDs:\s*{([^}]+)}/);
          if (idMatches && idMatches[1]) {
            // Parse the doctor ID mappings
            const idMappingsStr = idMatches[1].trim();
            idMappingsStr.split(',').forEach(mapping => {
              const [num, id] = mapping.split(':').map(s => s.trim());
              doctorIds[num] = id;
            });
          }
        } catch (err) {
          console.error('Error parsing doctor IDs:', err);
        }
        
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Doctors</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {doctorList.map((doctor, index) => {
                const [_, number, name, specialty] = doctor.match(/(\d+)\.\s+Dr\.\s+([^(]+)\(([^)]+)\)/) || [];
                // Get the doctor ID from our mapping, fallback to number if not found
                const doctorId = doctorIds[number] || number;
                const displayName = `Dr. ${name.trim()} (${specialty.trim()})`;
                
                return (
                  <button
                    key={index}
                    onClick={() => handleDoctorClick(doctorId, displayName)}
                    className="flex items-center p-4 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-all duration-200 group"
                    data-doctor-id={doctorId}
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3 group-hover:bg-red-200">
                      <span className="text-red-600 font-semibold">{number}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">Dr. {name.trim()}</p>
                      <p className="text-sm text-gray-600">{specialty.trim()}</p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>
        );
      } catch (error) {
        console.error('Error formatting doctor list:', error);
        return text;
      }
    }
    return null;
  };

  // Format date selection with enhanced UI
  const formatDateSelection = (text) => {
    if (text.includes('Available dates for appointment:')) {
      try {
        const dates = text.match(/\d{4}-\d{2}-\d{2}/g) || [];
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Dates</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {dates.map((date, index) => {
                const formattedDate = new Date(date);
                return (
                  <button
                    key={index}
                    onClick={() => handleDateClick(date)}
                    className="p-4 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-all duration-200 group text-center"
                  >
                    <div className="text-sm text-gray-600 mb-1">
                      {formattedDate.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="font-semibold text-gray-800">
                      {formattedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-sm text-gray-600">
                      {formattedDate.getFullYear()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      } catch (error) {
        console.error('Error formatting date selection:', error);
        return text;
      }
    }
    return null;
  };

  // Format message text with line breaks or Markdown
  const formatMessage = (text) => {
    // Check for doctor list
    const doctorListFormatted = formatDoctorList(text);
    if (doctorListFormatted) return doctorListFormatted;

    // Check for date selection
    const dateSelectionFormatted = formatDateSelection(text);
    if (dateSelectionFormatted) return dateSelectionFormatted;

    // Check if this is the welcome message
    if (text.includes('Welcome to AI HealthCare Assistant!')) {
      const [welcome, ...rest] = text.split('\n\n');
      return (
        <>
          <div className="welcome-header">
            <h2 className="text-2xl font-bold text-red-600 mb-4 flex items-center gap-2">
              <span>👋</span> 
              Welcome to AI HealthCare Assistant! 
              <span>👋</span>
            </h2>
          </div>
          <div className="welcome-content space-y-4">
            <p className="text-gray-700 font-medium">
              I'm your AI receptionist and I'm here to help you with your healthcare needs.
            </p>
            <p className="text-gray-700">
              When you book an appointment through chat, you'll have the option to secure it on the blockchain for additional protection.
            </p>
            <div className="mt-6">
              <p className="text-gray-800 font-medium mb-3">You can choose from the following options:</p>
              <div className="space-y-2 ml-4">
                <button 
                  onClick={() => handleOptionClick("1")}
                  className="option-item flex items-center gap-2 w-full text-left hover:bg-red-50 p-2 rounded-lg transition-colors duration-200"
                >
                  <span className="text-red-600 font-bold">1.</span>
                  <span>Book an appointment</span>
                </button>
                <button 
                  onClick={() => handleOptionClick("2")}
                  className="option-item flex items-center gap-2 w-full text-left hover:bg-red-50 p-2 rounded-lg transition-colors duration-200"
                >
                  <span className="text-red-600 font-bold">2.</span>
                  <span>Check my existing appointment</span>
                </button>
                <button 
                  onClick={() => handleOptionClick("3")}
                  className="option-item flex items-center gap-2 w-full text-left hover:bg-red-50 p-2 rounded-lg transition-colors duration-200"
                >
                  <span className="text-red-600 font-bold">3.</span>
                  <span>Cancel my appointment</span>
                </button>
                <button 
                  onClick={() => handleOptionClick("4")}
                  className="option-item flex items-center gap-2 w-full text-left hover:bg-red-50 p-2 rounded-lg transition-colors duration-200"
                >
                  <span className="text-red-600 font-bold">4.</span>
                  <span>View available doctors</span>
                </button>
                <button 
                  onClick={() => handleOptionClick("5")}
                  className="option-item flex items-center gap-2 w-full text-left hover:bg-red-50 p-2 rounded-lg transition-colors duration-200"
                >
                  <span className="text-red-600 font-bold">5.</span>
                  <span>Check symptoms</span>
                </button>
              </div>
            </div>
            <p className="text-gray-700 mt-4 font-medium italic">
              Just type the number of your choice, click an option, or describe what you need in your own words.
            </p>
          </div>
        </>
      );
    }

    // Check if the message contains doctor selection
    if (text.includes('Please select a doctor:') || text.includes('Available doctors:')) {
      try {
        // Extract doctor information
        const doctorList = text.match(/\d\.\s([^(\n]+)\s*\(([^)]+)\)/g) || [];
        
        // Parse the doctor list to get all doctor IDs
        const doctorIds = {};
        try {
          // Look for doctor IDs in the text
          const idMatches = text.match(/Doctor IDs:\s*{([^}]+)}/);
          if (idMatches && idMatches[1]) {
            // Parse the doctor ID mappings
            const idMappingsStr = idMatches[1].trim();
            idMappingsStr.split(',').forEach(mapping => {
              const [num, id] = mapping.split(':').map(s => s.trim());
              doctorIds[num] = id;
            });
          }
        } catch (err) {
          console.error('Error parsing doctor IDs:', err);
        }
        
        const formattedDoctors = doctorList.map(doctor => {
          const [_, number, name, specialty] = doctor.match(/(\d)\.\s([^(]+)\s*\(([^)]+)\)/);
          // Get the doctor ID from our mapping, fallback to number if not found
          const doctorId = doctorIds[number] || number;
          const displayName = `${name.trim()} (${specialty.trim()})`;
          
          return (
            <button
              key={number}
              onClick={() => handleDoctorClick(doctorId, displayName)}
              className="w-full text-left p-3 hover:bg-red-50 rounded-lg mb-2 transition-colors duration-200 flex items-center gap-2"
              data-doctor-id={doctorId}
            >
              <span className="text-red-600 font-bold">{number}.</span>
              <div>
                <span className="font-medium">{name.trim()}</span>
                <span className="text-gray-600 text-sm ml-2">({specialty.trim()})</span>
              </div>
            </button>
          );
        });

        return (
          <div className="space-y-2">
            <p className="font-medium mb-3">Please select a doctor:</p>
            <div className="space-y-1">
              {formattedDoctors}
            </div>
          </div>
        );
      } catch (error) {
        console.error('Error formatting doctor selection:', error);
      }
    }

    // Check if the message contains date selection
    if (text.includes('Available dates:')) {
      try {
        const dates = text.match(/\d{4}-\d{2}-\d{2}/g) || [];
        return (
          <div className="space-y-2">
            <p className="font-medium mb-3">Please select a date:</p>
            <div className="grid grid-cols-2 gap-2">
              {dates.map((date, index) => (
                <button
                  key={date}
                  onClick={() => handleDateClick(date)}
                  className="text-left p-3 hover:bg-red-50 rounded-lg transition-colors duration-200"
                >
                  {formatDate(date)}
                </button>
              ))}
            </div>
          </div>
        );
      } catch (error) {
        console.error('Error formatting date selection:', error);
      }
    }

    // Check if the message contains time slot selection
    if (text.includes('Available time slots:')) {
      try {
        const timeSlots = text.match(/\d{2}:\d{2}/g) || [];
        return (
          <div className="space-y-2">
            <p className="font-medium mb-3">Please select a time slot:</p>
            <div className="grid grid-cols-3 gap-2">
              {timeSlots.map((time, index) => (
                <button
                  key={time}
                  onClick={() => handleTimeClick(time)}
                  className="text-left p-3 hover:bg-red-50 rounded-lg transition-colors duration-200"
                >
                  {formatTime(time)}
                </button>
              ))}
            </div>
          </div>
        );
      } catch (error) {
        console.error('Error formatting time slot selection:', error);
      }
    }

    // Check if the text contains appointment information
    if (text.includes('Here are your appointments:')) {
      try {
        // Extract the appointments part
        const [intro, appointmentsText] = text.split('Here are your appointments:');
        if (!appointmentsText) return formatRegularText(text);

        // Parse the appointments JSON if present
        const appointmentsMatch = appointmentsText.match(/```json\n([\s\S]*?)\n```/);
        if (appointmentsMatch && appointmentsMatch[1]) {
          const appointments = JSON.parse(appointmentsMatch[1]);
          
          // Format appointments in a nice layout
          const formattedAppointments = appointments.map((apt, index) => `
### Appointment ${index + 1}

**Patient Details**
- Name: ${apt.name}
- Email: ${apt.email}
- Phone: ${apt.phone}
- Age: ${apt.age}
- Gender: ${apt.gender || 'Not specified'}

**Appointment Details**
- Doctor: ${apt.doctor}
- Date: ${formatDate(apt.appointment_date)}
- Time: ${formatTime(apt.appointment_time)}
- Reason: ${apt.reason || 'Not specified'}

---`).join('\n');

          // Combine intro with formatted appointments
          const formattedText = `${intro}\n\n${formattedAppointments}`;
          return <ReactMarkdown>{formattedText}</ReactMarkdown>;
        }
      } catch (error) {
        console.error('Error formatting appointments:', error);
      }
    }

    // Check if the text has other Markdown formatting
    if (text.includes('SYMPTOM ASSESSMENT:') || 
        text.includes('**') || 
        text.includes('# ') || 
        text.includes('- ') ||
        text.includes('*') ||
        text.includes('1. ')) {
      return <ReactMarkdown>{text}</ReactMarkdown>;
    }
    
    // For normal text messages, use line breaks
    return formatRegularText(text);
  };

  // Helper function to format regular text
  const formatRegularText = (text) => {
    return text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        <br />
      </React.Fragment>
    ));
  };

  // Helper function to format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Helper function to format time
  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Handle file upload button click
  const handleFileButtonClick = () => {
    fileInputRef.current.click();
  };
  
  // Handle file selection
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setUploadingFile(true);
      
      // Add message that file is being uploaded
      setMessages(prevMessages => [
        ...prevMessages, 
        { text: `Uploading medical history: ${file.name}...`, sender: 'bot' }
      ]);
      
      try {
        // Use the API client to upload the file
        const data = await healthcareApi.uploadMedicalHistoryFile(sessionId, file);
        
        // Add confirmation message
        setMessages(prevMessages => [
          ...prevMessages.filter(m => m.text !== `Uploading medical history: ${file.name}...`),
          { text: `Medical history "${file.name}" uploaded successfully.`, sender: 'bot' },
          { text: data.message || "Your medical history will be associated with your appointments.", sender: 'bot' }
        ]);
        
      } catch (err) {
        console.error('Error uploading file:', err);
        
        // Show the error message to the user
        setMessages(prevMessages => [
          ...prevMessages.filter(m => m.text !== `Uploading medical history: ${file.name}...`),
          { text: `Failed to upload medical history "${file.name}"`, sender: 'bot' },
          { text: `Error: ${err.message || 'Unknown error occurred during file upload'}`, sender: 'bot' }
        ]);
      }
    } catch (err) {
      console.error('Error handling file:', err);
      setMessages(prevMessages => [
        ...prevMessages.filter(m => m.text !== `Uploading medical history: ${file.name}...`),
        { text: `Failed to upload medical history "${file.name}": ${err.message}`, sender: 'bot' }
      ]);
    } finally {
      setUploadingFile(false);
      // Reset file input
      e.target.value = null;
    }
  };

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-lg w-full h-[700px] overflow-hidden border border-gray-100">
      {showManualBookingForm ? (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <button 
                className="flex items-center text-red-600 hover:text-red-700 font-medium"
                onClick={() => setShowManualBookingForm(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back to Chat
              </button>
            </div>
            <BookAppointmentForm onSuccess={handleManualBookingSuccess} />
          </div>
        </div>
      ) : (
        <>
          {/* Chat header */}
          <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white p-4 rounded-t-xl">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-white/20 flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold">Healthcare Assistant</h2>
              </div>
              <div className="flex items-center">
                {isConnected && (
                  <div className="text-xs bg-red-500 px-2.5 py-1 rounded-full flex items-center mr-2">
                    <span className="h-2 w-2 bg-white rounded-full mr-1.5 animate-pulse"></span>
                    Wallet Connected
                  </div>
                )}
                <div className="relative">
                  <button 
                    onClick={toggleSpeechRecognition}
                    className={`flex items-center justify-center h-8 w-8 rounded-full ${listening ? 'bg-red-500 animate-pulse' : 'bg-white/20 hover:bg-white/30'} transition-colors duration-200`}
                    title={listening ? "Stop listening" : "Speak your option"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                  {listening && (
                    <div className="absolute top-10 right-0 bg-white text-gray-800 px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap z-10">
                      Listening...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Messages area */}
          <div className="flex-1 p-6 overflow-y-auto bg-gradient-to-b from-gray-50 to-white">
            <div className="space-y-6 max-w-4xl mx-auto">
              {messages.map((message, index) => (
                <div 
                  key={index}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`rounded-2xl px-5 py-4 max-w-[80%] shadow-sm markdown-content ${
                      message.sender === 'user' 
                        ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white' 
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}
                  >
                    {formatMessage(message.text)}
                  </div>
                </div>
              ))}
              {(loading || blockchainLoading || uploadingFile) && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
                    <div className="flex space-x-2">
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-bounce"></div>
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div ref={messageEndRef} />
          </div>
          
          {/* Input area */}
          <form onSubmit={handleSendMessage} className="border-t p-4 bg-white">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-red-500 focus-within:border-red-500 max-w-4xl mx-auto">
              <button
                type="button"
                onClick={handleFileButtonClick}
                disabled={loading || blockchainLoading || uploadingFile}
                className="px-3 flex items-center justify-center text-gray-500 hover:text-red-600 transition-colors"
                title="Upload medical history"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf"
              />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading || blockchainLoading || listening || uploadingFile}
                placeholder={listening ? "Listening..." : "Type your message..."}
                className="flex-1 px-4 py-3 border-none focus:outline-none"
              />
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                disabled={loading || blockchainLoading || uploadingFile}
                className={`px-3 flex items-center justify-center ${
                  listening ? 'bg-red-500 text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
                title={listening ? "Stop listening" : "Speak your option"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              <button
                type="submit"
                disabled={loading || blockchainLoading || listening || uploadingFile || !input.trim()}
                className="bg-gradient-to-r from-red-500 to-rose-600 text-white px-6 py-3 hover:from-red-600 hover:to-rose-700 focus:outline-none disabled:from-red-400 disabled:to-rose-400 transition-all duration-200 flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default Chat;