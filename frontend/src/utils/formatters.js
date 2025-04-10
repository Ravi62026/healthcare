/**
 * Format and parse data for the healthcare app
 */

// Format date to locale format (e.g. June 15, 2023)
export const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

// Format time (e.g. 14:00 to 2:00 PM)
export const formatTime = (timeString) => {
  let hours = parseInt(timeString.split(':')[0], 10);
  const minutes = timeString.split(':')[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12
  
  return `${hours}:${minutes} ${ampm}`;
};

// Format appointment data for display
export const formatAppointment = (appointment) => {
  if (!appointment) return null;
  
  // Handle medical history file information
  const formattedAppointment = {
    ...appointment,
    formattedDate: formatDate(appointment.appointment_date),
    formattedTime: formatTime(appointment.appointment_time),
    has_medical_history: appointment.has_medical_history || false
  };
  
  // Add medical history filename if available
  if (appointment.medical_history_filename) {
    formattedAppointment.medical_history_filename = appointment.medical_history_filename;
  } else if (appointment.medical_history_file_path) {
    // Extract filename from path if only path is provided
    const pathParts = appointment.medical_history_file_path.split('/');
    formattedAppointment.medical_history_filename = pathParts[pathParts.length - 1];
  }
  
  return formattedAppointment;
};

// Parse API response for better handling
export const parseApiResponse = (response) => {
  // If response has appointment data, format it
  if (response.appointment) {
    response.appointment = formatAppointment(response.appointment);
  }
  
  return response;
};

// Format available slots for display and selection
export const formatAvailableSlots = (slots) => {
  const formattedSlots = {};
  
  Object.keys(slots).forEach(date => {
    formattedSlots[date] = {
      date: formatDate(date),
      rawDate: date,
      times: slots[date].map(time => ({
        time,
        formattedTime: formatTime(time)
      }))
    };
  });
  
  return formattedSlots;
}; 