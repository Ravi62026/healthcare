import React, { useState, useEffect, createContext } from 'react';
import { ethers } from 'ethers';
import { DEPLOY_ADDRESS, ABI } from '../context/constant';
import appointments from '../../appointments.json';
import Chat from './components/Chat';
import AppointmentChecker from './components/AppointmentChecker';
import DoctorPortal from './components/DoctorPortal';
import BookAppointmentForm from './components/BookAppointmentForm';
// import AIDoctor from './components/AIDoctor';
import healthcareApi from './api/healthcareApi';

// Create appointment context
export const AppointmentContext = createContext();

const App = () => {
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [doctors, setDoctors] = useState([]);
  const [availableSlots, setAvailableSlots] = useState({});
  const [lastBookedAppointment, setLastBookedAppointment] = useState(null);
  const [userAppointments, setUserAppointments] = useState([]);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [fetchingAppointments, setFetchingAppointments] = useState(false);

  // Fetch initial data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const doctorsResponse = await healthcareApi.getDoctors();
        setDoctors(doctorsResponse.data?.doctors || []);
        
        const slotsResponse = await healthcareApi.getAvailableSlots();
        setAvailableSlots(slotsResponse.available_slots);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    
    fetchData();
  }, []);

  // Connect wallet function
  const connectWallet = async () => {
    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);
        
        // Initialize contract
        const contractInstance = new ethers.Contract(DEPLOY_ADDRESS, ABI, signer);
        setContract(contractInstance);
        setIsConnected(true);
        return { success: true, account: address, contract: contractInstance };
      } else {
        alert("Please install MetaMask!");
        return { success: false, error: "MetaMask not installed" };
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      return { success: false, error: error.message };
    }
  };

  // Book appointment function
  const bookAppointment = async (appointmentData = null) => {
    try {
      if (!contract) {
        const connection = await connectWallet();
        if (!connection.success) return { success: false, error: connection.error };
      }
      
      setLoading(true);
      
      // Use provided appointment data or fallback to the last one in the appointments file
      const data = appointmentData || appointments[appointments.length - 1];
      
      const tx = await contract.createAppointment(
        data.name,
        data.email,
        data.phone,
        parseInt(data.age),
        data.gender,
        data.reason,
        data.doctor,
        data.appointment_date,
        data.appointment_time
      );
      
      await tx.wait();
      
      // Store the appointment data
      setLastBookedAppointment(data);
      console.log(tx);
      console.log("Appointment data:");
      console.log(data);
      alert("Appointment booked successfully on blockchain!");
      
      return {
        success: true,
        message: "Appointment booked successfully on blockchain!",
        transaction: tx,
        appointmentData: data
      };
    } catch (error) {
      console.error("Error booking appointment:", error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Fetch user appointments from blockchain
  const fetchUserAppointments = async () => {
    if (!contract || !account) return;
    
    try {
      setFetchingAppointments(true);
      
      // Get appointment IDs for the current user
      const appointmentIds = await contract.getPatientAppointments(account);
      
      // Get total appointment count
      const count = await contract.getAppointmentCount();
      setAppointmentCount(Number(count));
      
      // Get details for each appointment
      const appointments = [];
      for (let i = 0; i < appointmentIds.length; i++) {
        const id = appointmentIds[i];
        const appointmentDetails = await contract.getAppointment(id);
        
        appointments.push({
          id: Number(id),
          name: appointmentDetails[0],
          email: appointmentDetails[1],
          phone: appointmentDetails[2],
          age: Number(appointmentDetails[3]),
          gender: appointmentDetails[4],
          reason: appointmentDetails[5],
          doctor: appointmentDetails[6],
          appointmentDate: appointmentDetails[7],
          appointmentTime: appointmentDetails[8],
          timestamp: Number(appointmentDetails[9]),
          patientAddress: appointmentDetails[10]
        });
      }
      
      setUserAppointments(appointments);
    } catch (error) {
      console.error("Error fetching user appointments:", error);
    } finally {
      setFetchingAppointments(false);
    }
  };
  
  // Get specific appointment details
  const getAppointmentDetails = async (appointmentId) => {
    if (!contract) return null;
    
    try {
      const appointmentDetails = await contract.getAppointment(appointmentId);
      
      return {
        id: Number(appointmentId),
        name: appointmentDetails[0],
        email: appointmentDetails[1],
        phone: appointmentDetails[2],
        age: Number(appointmentDetails[3]),
        gender: appointmentDetails[4],
        reason: appointmentDetails[5],
        doctor: appointmentDetails[6],
        appointmentDate: appointmentDetails[7],
        appointmentTime: appointmentDetails[8],
        timestamp: Number(appointmentDetails[9]),
        patientAddress: appointmentDetails[10]
      };
    } catch (error) {
      console.error("Error fetching appointment details:", error);
      return null;
    }
  };

  // Load user appointments when account changes
  useEffect(() => {
    if (isConnected && contract && account) {
      fetchUserAppointments();
    }
  }, [isConnected, contract, account]);
  
  // Context value
  const appointmentContextValue = {
    connectWallet,
    bookAppointmentOnBlockchain: bookAppointment,
    isConnected,
    account,
    contract,
    doctors,
    availableSlots,
    lastBookedAppointment,
    setLastBookedAppointment,
    fetchUserAppointments,
    getAppointmentDetails
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date) 
      ? date.toLocaleDateString() 
      : dateStr;
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <Chat />;
      case 'check':
        return <AppointmentChecker />;
      case 'doctors':
        return <DoctorPortal />;
      case 'book':
        return <BookAppointmentForm 
          onSuccess={(appointment) => {
            alert('Appointment booked successfully!');
            setLastBookedAppointment(appointment);
          }} 
        />;
      case 'blockchain':
        return (
          <div className="space-y-6 bg-gradient-to-b from-red-50 to-white p-6 rounded-xl shadow-sm">
            {!isConnected ? (
              <div className="text-center">
                <p className="mb-4 text-gray-600">Connect your wallet to access blockchain features</p>
                <button
                  onClick={connectWallet}
                  className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-medium py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center mx-auto"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  Connect Wallet
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-center bg-red-100 p-3 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="font-medium">Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
                </div>
                
                {/* Blockchain Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-2 text-gray-800 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
                      </svg>
                      Blockchain Status
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Appointments:</span>
                        <span className="font-medium">{appointmentCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Your Appointments:</span>
                        <span className="font-medium">{userAppointments.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Contract:</span>
                        <span className="font-medium text-xs">{DEPLOY_ADDRESS.slice(0, 6)}...{DEPLOY_ADDRESS.slice(-4)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-2 text-gray-800 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Blockchain Actions
                    </h3>
                    <div className="space-y-3">
                    <button
                        onClick={() => bookAppointment()}
                      disabled={loading}
                      className={`w-full ${
                          loading ? 'bg-gray-400' : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600'
                        } text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center`}
                      >
                        {loading ? (
                          <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4zm7 5a1 1 0 10-2 0v1H8a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                          </svg>
                        )}
                      {loading ? 'Processing...' : 'Book Appointment'}
                    </button>
                      
                      <button
                        onClick={fetchUserAppointments}
                        disabled={fetchingAppointments}
                        className={`w-full ${
                          fetchingAppointments ? 'bg-gray-400' : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600'
                        } text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center`}
                      >
                        {fetchingAppointments ? (
                          <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                          </svg>
                        )}
                        {fetchingAppointments ? 'Fetching...' : 'Refresh Appointments'}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* User's Blockchain Appointments */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    Your Blockchain Appointments
                  </h3>
                  
                  {fetchingAppointments ? (
                    <div className="flex justify-center py-8">
                      <svg className="animate-spin h-8 w-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : userAppointments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>You don't have any appointments on the blockchain yet.</p>
                      <p className="mt-2 text-sm">Book an appointment to see it here!</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full table-auto">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {userAppointments.map(appointment => (
                            <tr key={appointment.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap">{appointment.name}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{appointment.doctor}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{formatDate(appointment.appointmentDate)}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{appointment.appointmentTime}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <button 
                                  onClick={() => setSelectedAppointment(appointment)}
                                  className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                                >
                                  <span>View</span>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                
                {/* Selected Appointment Details Modal */}
                {selectedAppointment && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4 relative">
                      <button 
                        onClick={() => setSelectedAppointment(null)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>

                      <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Appointment Details
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <div className="space-y-4">
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="font-medium text-gray-800 mb-2">Patient Information</h4>
                            <div className="space-y-2">
                              <p className="text-sm">
                                <span className="text-gray-500">Name:</span>
                                <span className="ml-2 font-medium">{selectedAppointment.name}</span>
                              </p>
                              <p className="text-sm">
                                <span className="text-gray-500">Email:</span>
                                <span className="ml-2 font-medium">{selectedAppointment.email}</span>
                              </p>
                              <p className="text-sm">
                                <span className="text-gray-500">Phone:</span>
                                <span className="ml-2 font-medium">{selectedAppointment.phone}</span>
                              </p>
                              <p className="text-sm">
                                <span className="text-gray-500">Age:</span>
                                <span className="ml-2 font-medium">{selectedAppointment.age}</span>
                              </p>
                              <p className="text-sm">
                                <span className="text-gray-500">Gender:</span>
                                <span className="ml-2 font-medium">{selectedAppointment.gender}</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="font-medium text-gray-800 mb-2">Appointment Information</h4>
                            <div className="space-y-2">
                              <p className="text-sm">
                                <span className="text-gray-500">Doctor:</span>
                                <span className="ml-2 font-medium">{selectedAppointment.doctor}</span>
                              </p>
                              <p className="text-sm">
                                <span className="text-gray-500">Date:</span>
                                <span className="ml-2 font-medium">{formatDate(selectedAppointment.appointmentDate)}</span>
                              </p>
                              <p className="text-sm">
                                <span className="text-gray-500">Time:</span>
                                <span className="ml-2 font-medium">{selectedAppointment.appointmentTime}</span>
                              </p>
                              <p className="text-sm">
                                <span className="text-gray-500">Reason:</span>
                                <span className="ml-2 font-medium">{selectedAppointment.reason || 'Not specified'}</span>
                              </p>
                              <p className="text-sm">
                                <span className="text-gray-500">Appointment ID:</span>
                                <span className="ml-2 font-medium">{selectedAppointment.id}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 bg-red-50 p-4 rounded-lg">
                        <p className="text-sm text-red-800 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          This appointment is securely stored on the blockchain and cannot be modified
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Display doctors and available slots */}
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                Available Doctors
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {doctors.map((doctor) => (
                  <div key={doctor.id} className="border p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 bg-white">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                        <span className="text-red-600 font-medium">{doctor.name.charAt(0)}</span>
                      </div>
                      <div className="ml-3">
                        <p className="text-gray-800 font-medium">{doctor.name}</p>
                        <p className="text-gray-500 text-sm">{doctor.specialty}</p>
                        <p className="text-gray-400 text-xs">{doctor.experience} Experience</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Display last booked appointment if exists */}
            {lastBookedAppointment && (
              <div className="mt-8 p-5 border rounded-xl shadow-sm bg-gradient-to-r from-red-50 to-rose-50">
                <h3 className="text-lg font-semibold mb-3 text-red-800 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Last Blockchain Appointment
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium text-gray-800">{lastBookedAppointment.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Doctor</p>
                    <p className="font-medium text-gray-800">{lastBookedAppointment.doctor}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium text-gray-800">{lastBookedAppointment.appointment_date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Time</p>
                    <p className="font-medium text-gray-800">{lastBookedAppointment.appointment_time}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return <Chat />;
    }
  };

  return (
    <AppointmentContext.Provider value={appointmentContextValue}>
      <div className="min-h-screen bg-gradient-to-b from-red-50 via-white to-gray-50">
        <header className="bg-gradient-to-r from-red-600 to-rose-600 shadow-md">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl md:text-3xl font-bold text-white text-center">Healthcare Appointment System</h1>
          </div>
        </header>
        
        <div className="container mx-auto px-4 py-6">
          {/* Navigation Tabs */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-md shadow-sm p-1 bg-gray-100 w-full max-w-2xl">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === 'chat' 
                    ? 'bg-white text-red-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                  Chat Assistant
                </div>
              </button>
              <button
                onClick={() => setActiveTab('check')}
                className={`flex-1 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === 'check' 
                    ? 'bg-white text-red-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  Check/Cancel
                </div>
              </button>
              <button
                onClick={() => setActiveTab('doctors')}
                className={`flex-1 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === 'doctors' 
                    ? 'bg-white text-red-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  Doctors Portal
                </div>
              </button>
              <button
                onClick={() => setActiveTab('book')}
                className={`flex-1 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === 'book' 
                    ? 'bg-white text-red-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
                  </svg>
                  Book Appointment
                </div>
              </button>
              <button
                onClick={() => setActiveTab('blockchain')}
                className={`flex-1 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === 'blockchain' 
                    ? 'bg-white text-red-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
                  </svg>
                  Blockchain
                </div>
              </button>
            </div>
          </div>
          
          {/* Content based on active tab */}
          <div className="max-w-4xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </div>
    </AppointmentContext.Provider>
  );
};

export default App;