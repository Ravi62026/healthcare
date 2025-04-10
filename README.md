# Healthcare Project Technical Report

## Executive Summary

The Healthcare Project is a comprehensive healthcare management solution that combines a powerful Python-based backend with a modern React frontend and advanced AI capabilities. The system provides patient-doctor interaction, appointment management, medical consultations via AI agents, and medical records management. This technical report provides detailed information on the architecture, installation, and functionalities of the entire system.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Project Structure](#project-structure)
3. [Technologies Used](#technologies-used)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [AI Integration](#ai-integration)
7. [Database Design](#database-design)
8. [Installation and Setup](#installation-and-setup)
9. [API Documentation](#api-documentation)
10. [Troubleshooting](#troubleshooting)
11. [Future Enhancements](#future-enhancements)

## System Architecture

The Healthcare Project follows a client-server architecture with three main components:

1. **Backend Server**: Flask-based RESTful API service that handles business logic and data management
2. **Frontend Client**: React-based user interface for patient and doctor interactions
3. **AI Module**: LangChain and Google Gemini-powered module for natural language understanding and specialized medical consultations

The system is designed to be scalable, with separate components that can be deployed independently.

## Project Structure

```
HealthcareProject/
├── app.py                    # Main Flask application entry point
├── chatbot.py                # Healthcare chatbot implementation
├── requirements.txt          # Python dependencies
├── .env                      # Environment variables (API keys, config)
├── doctor.json               # Doctor information database
├── appointments.json         # Appointment records
├── README.md                 # Project documentation
│
├── frontend/                 # React frontend application
│   ├── package.json          # Node.js dependencies
│   ├── vite.config.js        # Vite configuration
│   ├── index.html            # HTML entry point
│   ├── public/               # Static assets
│   └── src/                  # Source code
│       ├── App.jsx           # Main application component
│       ├── main.jsx          # Application entry point
│       ├── index.css         # Global styles
│       ├── components/       # Reusable UI components
│       ├── api/              # API integration
│       ├── hooks/            # Custom React hooks
│       ├── utils/            # Utility functions
│       ├── assets/           # Images, icons, etc.
│       ├── services/         # Service modules
│       └── context/          # React context providers
│
├── medical_records/          # Uploaded medical records storage
├── medical_history_files/    # Medical history document storage
└── uploads/                  # General file uploads
```

## Technologies Used

### Backend

- **Flask**: Web framework for the backend API
- **Flask-CORS**: Cross-origin resource sharing support
- **Python-dotenv**: Environment variable management
- **LangChain**: Framework for AI agent development
- **Google Generative AI**: Large language model for AI assistants
- **Tavily API**: Health information search capability

### Frontend

- **React**: JavaScript library for building user interfaces
- **Vite**: Frontend build tool and development server
- **Context API**: State management solution
- **React Router**: Navigation and routing
- **CSS Modules**: Component-scoped styling

### AI Components

- **LangChain**: Framework for developing applications with LLMs
- **Google Gemini Pro**: Large language model for generating responses
- **ConversationBufferMemory**: Maintains context in conversations
- **Custom AI Specialists**: Specialized AI agents for different medical domains

## Backend Implementation

The backend is implemented using Flask and provides RESTful APIs for all functionalities. The core components include:

### app.py (Main Server Application)

- Entry point for the Flask application
- Handles HTTP requests and responses
- API route definitions
- Authentication and session management
- Integration with AI components
- File uploads and management

Key APIs:

- `/api/chat`: General healthcare chatbot interactions
- `/api/book-appointment`: Appointment booking endpoints
- `/api/doctors`: Doctor information retrieval
- `/api/ai/specialists`: AI specialist consultation endpoints
- `/api/upload-medical-history`: Medical record management

### chatbot.py (Healthcare Bot Implementation)

- Implementation of the HealthcareBot class
- Tool-based agent architecture using LangChain
- Natural language understanding and generation
- Integration with medical knowledge sources
- Appointment management logic
- Symptom analysis capabilities

Key features:

- LLM-powered healthcare assistant
- Appointment booking flows
- Medical information retrieval
- Symptom checking
- Medical history management

## Frontend Implementation

The frontend is built using React and follows a component-based architecture:

### Key Components

- **Authentication**: User login/registration components
- **Patient Dashboard**: Overview of appointments and medical history
- **Doctor Dashboard**: Doctor view for managing appointments
- **Appointment Booking**: Interactive appointment scheduling interface
- **Chat Interface**: Real-time chatbot interaction
- **AI Consultation**: Specialized AI doctor consultations
- **Medical Records**: Upload and management of medical documents

The frontend communicates with the backend using RESTful API calls and implements responsive design for mobile and desktop use.

## AI Integration

The system incorporates advanced AI capabilities through several integration points:

### Healthcare Chatbot

- General healthcare assistant for basic inquiries
- Appointment booking and management
- Simple symptom assessment
- Healthcare information provision

### Specialized AI Consultations

- **Brain Tumor Specialist**: Neurosurgery and neuro-oncology expertise
- **Breast Cancer Specialist**: Oncology focused on breast cancer
- **Diabetes Specialist**: Endocrinology focused on diabetes management
- **Lung Disease Specialist**: Pulmonology expertise

Each specialist is powered by a customized LLM with specific medical knowledge and context, providing detailed consultations in their domains of expertise.

## Database Design

The system uses JSON-based file storage for simplicity:

- **doctor.json**: Stores doctor information including specialties and availability
- **appointments.json**: Records all appointment data
- **medical_history.json**: Stores patient medical history
- **medications.json**: Maintains medication records

In a production environment, these would be replaced with a proper database system like PostgreSQL or MongoDB.

## Installation and Setup

### Prerequisites

- Python 3.8+
- Node.js 14+
- npm or yarn
- API keys for Google Gemini and Tavily (optional)

### Backend Setup

1. **Clone the Repository**

   ```sh
   git clone https://github.com/your-username/healthcare-project.git
   cd healthcare-project
   ```

2. **Set Up Python Environment with Conda**

   ```sh
   # Create a new conda environment
   conda create -n healthcare-env python=3.8
   conda activate healthcare-env

   # Install required packages
   pip install -r requirements.txt
   ```

   Alternatively, use a virtual environment:

   ```sh
   python -m venv venv
   # On Windows
   venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate

   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**

   Create a `.env` file in the project root with the following:

   ```
   GOOGLE_API_KEY=your_google_api_key
   TAVILY_API_KEY=your_tavily_api_key
   SECRET_KEY=your_secret_key
   ```

4. **Start the Backend Server**

   ```sh
   python app.py
   ```

   The server will start on http://localhost:5000 by default.

### Frontend Setup

1. **Navigate to the Frontend Directory**

   ```sh
   cd frontend
   ```

2. **Install Dependencies**

   ```sh
   npm install
   ```

3. **Start the Development Server**

   ```sh
   npm run dev
   ```

   The frontend will be accessible at http://localhost:3000.

## API Documentation

### Core API Endpoints

#### Authentication

- `POST /api/doctor/login`: Doctor authentication

#### Appointment Management

- `POST /api/book-appointment`: Create a new appointment
- `POST /api/check-appointment`: Check existing appointments
- `POST /api/cancel-appointment`: Cancel an appointment
- `GET /api/available-slots`: Get available appointment slots
- `GET /api/doctors`: List available doctors
- `POST /api/doctor/appointments`: Get appointments for a specific doctor

#### AI Chatbot

- `POST /api/chat`: Interact with the general healthcare chatbot
- `POST /api/check-symptoms`: Submit symptoms for analysis

#### AI Doctor Specialists

- `GET /api/ai/specialists`: List available AI specialists
- `POST /api/ai/create_session`: Create a consultation session with an AI specialist
- `POST /api/ai/chat`: Interact with an AI specialist
- `POST /api/ai/upload_medical_record`: Upload medical records for AI consultation
- `GET /api/ai/medical_records/<session_id>`: Retrieve uploaded medical records

#### Medical Records

- `POST /api/upload-medical-history`: Upload medical history documents
- `GET /api/medical-history-file/<filename>`: Retrieve medical history documents

## Troubleshooting

### Backend Issues

- **API Key Errors**: Ensure the `.env` file contains valid API keys
- **Flask Server Errors**: Check the console output for specific error messages
- **AI Module Issues**: Verify that the Google Gemini API is accessible

### Frontend Issues

- **Build Errors**: Ensure all dependencies are installed with `npm install`
- **API Connection Issues**: Verify that the backend server is running
- **UI Rendering Problems**: Check browser console for JavaScript errors

## Future Enhancements

1. **Database Migration**: Replace JSON file storage with a proper database
2. **Authentication System**: Implement JWT-based authentication
3. **Real-time Notifications**: Add WebSocket support for real-time updates
4. **Mobile Application**: Develop native mobile clients
5. **Advanced AI Integration**: Enhance AI capabilities with more specialized models
6. **Telemedicine Features**: Add video consultation capabilities
7. **Electronic Health Records**: Integrate with EHR systems

---

## Getting Started Guide

To quickly get started with the Healthcare Project:

1. Clone the repository
2. Set up the backend environment (see Backend Setup)
3. Configure the required API keys in `.env`
4. Start the backend server with `python app.py`
5. Set up and start the frontend (see Frontend Setup)
6. Access the application at http://localhost:3000

For any issues or questions, please refer to the Troubleshooting section or contact the repository maintainers.
