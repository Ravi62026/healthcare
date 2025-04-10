// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

contract AppointmentContract {
    // Struct to store appointment details
    struct Appointment {
        string name;
        string email;
        string phone;
        uint256 age;
        string gender;
        string reason;
        string doctor;
        string appointmentDate;
        string appointmentTime;
        uint256 timestamp;
        address patientAddress;
    }

    // Array to store all appointments
    Appointment[] public appointments;

    // Mapping from patient address to their appointment IDs
    mapping(address => uint256[]) public patientAppointments;

    // Event emitted when a new appointment is created
    event AppointmentCreated(
        uint256 indexed appointmentId,
        string name,
        string doctor,
        string appointmentDate,
        string appointmentTime
    );

    // Function to create a new appointment
    function createAppointment(
        string memory _name,
        string memory _email,
        string memory _phone,
        uint256 _age,
        string memory _gender,
        string memory _reason,
        string memory _doctor,
        string memory _appointmentDate,
        string memory _appointmentTime
    ) public returns (uint256) {
        // Create a new appointment
        Appointment memory newAppointment = Appointment({
            name: _name,
            email: _email,
            phone: _phone,
            age: _age,
            gender: _gender,
            reason: _reason,
            doctor: _doctor,
            appointmentDate: _appointmentDate,
            appointmentTime: _appointmentTime,
            timestamp: block.timestamp,
            patientAddress: msg.sender
        });

        // Add the appointment to the array
        uint256 appointmentId = appointments.length;
        appointments.push(newAppointment);

        // Add the appointment ID to the patient's appointments
        patientAppointments[msg.sender].push(appointmentId);

        // Emit the event
        emit AppointmentCreated(
            appointmentId,
            _name,
            _doctor,
            _appointmentDate,
            _appointmentTime
        );

        return appointmentId;
    }

    // Function to get appointment details by ID
    function getAppointment(
        uint256 _appointmentId
    )
        public
        view
        returns (
            string memory name,
            string memory email,
            string memory phone,
            uint256 age,
            string memory gender,
            string memory reason,
            string memory doctor,
            string memory appointmentDate,
            string memory appointmentTime,
            uint256 timestamp,
            address patientAddress
        )
    {
        require(
            _appointmentId < appointments.length,
            "Appointment does not exist"
        );

        Appointment memory appointment = appointments[_appointmentId];

        return (
            appointment.name,
            appointment.email,
            appointment.phone,
            appointment.age,
            appointment.gender,
            appointment.reason,
            appointment.doctor,
            appointment.appointmentDate,
            appointment.appointmentTime,
            appointment.timestamp,
            appointment.patientAddress
        );
    }

    // Function to get all appointments for a patient
    function getPatientAppointments(
        address _patientAddress
    ) public view returns (uint256[] memory) {
        return patientAppointments[_patientAddress];
    }

    // Function to get the total number of appointments
    function getAppointmentCount() public view returns (uint256) {
        return appointments.length;
    }
}
