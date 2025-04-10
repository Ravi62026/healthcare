import { useContext } from 'react';
import { AppointmentContext } from '../App';

/**
 * Custom hook to access the appointment context
 * @returns {Object} Appointment context values and methods
 */
const useAppointment = () => {
  const context = useContext(AppointmentContext);

  if (!context) {
    throw new Error('useAppointment must be used within an AppointmentContext.Provider');
  }

  return context;
};

export default useAppointment; 