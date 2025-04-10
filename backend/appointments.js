const fs = require('fs');
const path = require('path');

// Load doctors data
const doctorsData = require('../doctor.json');

// Store booked appointments in memory (in production, this should be a database)
let bookedSlots = new Map();

// Initialize from a JSON file if it exists
try {
  const bookedSlotsData = require('./bookedSlots.json');
  Object.entries(bookedSlotsData).forEach(([key, value]) => {
    bookedSlots.set(key, value);
  });
} catch (error) {
  console.log('No existing booked slots found, starting fresh');
}

// Save booked slots to file
const saveBookedSlots = () => {
  const data = Object.fromEntries(bookedSlots);
  fs.writeFileSync(
    path.join(__dirname, 'bookedSlots.json'),
    JSON.stringify(data, null, 2)
  );
};

// Get available slots for a specific doctor on a specific date
const getAvailableSlots = (doctorId, date) => {
  const doctor = doctorsData.doctors.find(d => d.id === doctorId);
  if (!doctor) return [];

  // Get the day of week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = new Date(date).getDay();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = days[dayOfWeek];

  // Get all slots for that day from doctor's availability
  const allSlots = doctor.availability[dayName] || [];

  // Get booked slots for this doctor on this date
  const bookedSlotsKey = `${doctorId}-${date}`;
  const doctorBookedSlots = bookedSlots.get(bookedSlotsKey) || [];

  // Filter out booked slots
  return allSlots.filter(slot => !doctorBookedSlots.includes(slot));
};

// Book a slot
const bookSlot = (doctorId, date, time) => {
  const key = `${doctorId}-${date}`;
  const currentBookings = bookedSlots.get(key) || [];
  
  // Check if slot is already booked
  if (currentBookings.includes(time)) {
    return {
      success: false,
      message: 'This slot is already booked'
    };
  }

  // Check if slot exists in doctor's availability
  const availableSlots = getAvailableSlots(doctorId, date);
  if (!availableSlots.includes(time)) {
    return {
      success: false,
      message: 'This slot is not available'
    };
  }

  // Book the slot
  bookedSlots.set(key, [...currentBookings, time]);
  saveBookedSlots();

  return {
    success: true,
    message: 'Slot booked successfully'
  };
};

// Cancel a booking
const cancelSlot = (doctorId, date, time) => {
  const key = `${doctorId}-${date}`;
  const currentBookings = bookedSlots.get(key) || [];

  if (!currentBookings.includes(time)) {
    return {
      success: false,
      message: 'No booking found for this slot'
    };
  }

  // Remove the booking
  bookedSlots.set(
    key,
    currentBookings.filter(t => t !== time)
  );
  saveBookedSlots();

  return {
    success: true,
    message: 'Booking cancelled successfully'
  };
};

// Get all available slots for all doctors
const getAllAvailableSlots = (date) => {
  const result = {};
  
  doctorsData.doctors.forEach(doctor => {
    result[doctor.id] = {
      name: doctor.name,
      specialty: doctor.specialty,
      qualification: doctor.qualification,
      slots: getAvailableSlots(doctor.id, date)
    };
  });

  return result;
};

module.exports = {
  getAvailableSlots,
  bookSlot,
  cancelSlot,
  getAllAvailableSlots
}; 