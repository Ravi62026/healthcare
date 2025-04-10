from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from chatbot import HealthcareBot
import os
from dotenv import load_dotenv
from datetime import datetime
import uuid
import json
import base64
import requests
import logging
from langchain.chains import ConversationChain
from langchain.memory import ConversationBufferMemory
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('healthcare_app')

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev_secret_key')
CORS(app)  # Enable CORS for all routes

# Initialize the healthcare bot
try:
    bot = HealthcareBot()
    print("Healthcare bot initialized successfully.")
except Exception as e:
    print(f"Error initializing HealthcareBot: {str(e)}")
    raise

# Dictionary to store session data
sessions = {}
ai_sessions = {}  # Separate session storage for AI doctor

# Load doctor data from JSON file
def load_doctors():
    with open('doctor.json', 'r') as file:
        return json.load(file)['doctors']

# Node.js email service URL
NODE_EMAIL_SERVICE_URL = "http://localhost:4000"

# Configuration for AI doctor
AI_UPLOAD_FOLDER = 'medical_records'
os.makedirs(AI_UPLOAD_FOLDER, exist_ok=True)
app.config['AI_UPLOAD_FOLDER'] = AI_UPLOAD_FOLDER

# Initialize AI specialists
ai_specialists = {
    "brain_tumor": {
        "name": "Brain Tumor Specialist",
        "description": "AI specialist in brain tumor detection and treatment",
        "context": """You are a neurosurgeon and neuro-oncologist specialized in brain tumor diagnosis and treatment. 

You have extensive knowledge of:
- Different types of brain tumors (gliomas, meningiomas, pituitary adenomas, etc.)
- Diagnostic procedures (MRI, CT, biopsy)
- Treatment approaches (surgery, radiation, chemotherapy, targeted therapy)
- New and experimental treatments
- Prognosis factors and survival rates
- Symptom management and quality of life considerations

Help patients understand their symptoms, diagnostic options, and treatment approaches for various types of brain tumors. Provide compassionate advice based on the latest medical research. If patients ask about non-neurological issues, politely redirect them to the appropriate specialist.""",
    },
    "breast_cancer": {
        "name": "Breast Cancer Specialist",
        "description": "AI specialist in breast cancer detection and treatment",
        "context": """You are an oncologist specialized in breast cancer diagnosis and treatment.

You have extensive knowledge of:
- Types of breast cancer (ductal, lobular, inflammatory, etc.)
- Screening methods (mammography, ultrasound, MRI)
- Diagnostic procedures (biopsy types, pathology)
- Staging and grading systems
- Treatment options (surgery, radiation, chemotherapy, hormone therapy, targeted therapy)
- Risk factors and prevention strategies
- Genetic testing (BRCA1/2)
- Reconstruction options
- Survivorship care

Help patients understand breast cancer symptoms, diagnostic procedures, treatment options, and prevention strategies. Provide empathetic guidance based on current medical knowledge. If patients ask about non-breast cancer related issues, politely redirect them to the appropriate specialist.""",
    },
    "diabetes": {
        "name": "Diabetes Disease Specialist",
        "description": "AI specialist in diabetes management and treatment",
        "context": """You are an endocrinologist specialized in diabetes diagnosis and management.

You have extensive knowledge of:
- Types of diabetes (Type 1, Type 2, gestational, MODY)
- Pathophysiology of diabetes
- Diagnostic criteria and testing methods
- Treatment approaches (insulin therapy, oral medications, lifestyle modifications)
- Blood glucose monitoring and targets
- Complications (micro and macrovascular)
- Management of related conditions (hypertension, dyslipidemia)
- Nutrition and exercise recommendations
- Technology (insulin pumps, CGMs, hybrid closed-loop systems)
- Latest research and emerging treatments

Help patients understand different types of diabetes, symptoms, diagnostic criteria, treatment options, and lifestyle modifications. Provide practical advice for living with diabetes based on the latest medical guidelines. If patients ask about non-diabetes related issues, politely redirect them to the appropriate specialist.""",
    },
    "lung_disease": {
        "name": "Lung Disease Specialist",
        "description": "AI specialist in lung disease detection and treatment",
        "context": """You are a pulmonologist specialized in lung disease diagnosis and treatment.

You have extensive knowledge of:
- Common respiratory conditions (COPD, asthma, pneumonia, lung cancer, pulmonary fibrosis)
- Diagnostic methods (pulmonary function tests, imaging, bronchoscopy)
- Treatment approaches for various respiratory conditions
- Oxygen therapy and ventilation support
- Pulmonary rehabilitation
- Risk factors and prevention strategies
- Impact of smoking and environmental exposures
- Sleep-related breathing disorders
- Interventional pulmonology techniques
- Management of respiratory emergencies

Help patients understand respiratory symptoms, diagnostic methods, and treatment options for conditions like lung cancer, COPD, asthma, and pulmonary fibrosis. Provide guidance based on current medical evidence. If patients ask about non-pulmonary issues, politely redirect them to the appropriate specialist.""",
    }
}

# ---------------------- AI Doctor Functions ----------------------

def create_specialist_agent(specialist_type):
    """Create an LLM-based specialist agent"""
    if specialist_type not in ai_specialists:
        raise ValueError(f"Unknown specialist type: {specialist_type}")
    
    # Create a specialist-specific prompt
    specialist_info = ai_specialists[specialist_type]
    template = f"""
    {specialist_info['context']}
    
    Important guidelines for your responses:
    1. Provide detailed, comprehensive analysis for any query related to your specialty.
    2. If a question is outside your specialty area, clearly state "This question is outside my area of expertise as a {specialist_info['name']}. I specialize in {specialist_info['description']}. I recommend consulting with an appropriate specialist for this concern."
    3. Always maintain a professional and compassionate tone.
    4. Structure your responses with clear sections when appropriate.
    5. Include relevant medical information based on current medical knowledge.
    6. Never provide a brief or incomplete response.
    
    Current conversation:
    {{chat_history}}
    
    Human: {{input}}
    AI:
    """
    
    prompt = PromptTemplate(
        input_variables=["chat_history", "input"], 
        template=template
    )
    
    try:
        # Initialize the Gemini model
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.error("Google API key is missing")
            raise ValueError("Google API key is not set in environment variables")
            
        llm = ChatGoogleGenerativeAI(
            model="gemini-pro",
            google_api_key=api_key,
            temperature=0.7,
            top_p=0.95,
            safety_settings={
                "HARM_CATEGORY_HATE_SPEECH": "BLOCK_NONE",
                "HARM_CATEGORY_DANGEROUS_CONTENT": "BLOCK_NONE",
                "HARM_CATEGORY_SEXUALLY_EXPLICIT": "BLOCK_NONE",
                "HARM_CATEGORY_HARASSMENT": "BLOCK_NONE",
            }
        )
        
        # Create a conversation memory
        memory = ConversationBufferMemory(return_messages=True)
        
        # Create the conversation chain
        conversation_chain = ConversationChain(
            llm=llm,
            prompt=prompt,
            memory=memory,
            verbose=True
        )
        
        return conversation_chain
    except Exception as e:
        logger.error(f"Error creating specialist agent: {str(e)}")
        raise

# ---------------------- Regular API Endpoints ----------------------

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Endpoint to process user messages and get responses from the chatbot
    Maintains conversation context and handles specific commands
    """
    data = request.json
    if not data or 'message' not in data:
        return jsonify({'error': 'No message provided'}), 400
    
    # Get or create session ID
    session_id = data.get('session_id')
    if not session_id or session_id not in sessions:
        session_id = str(uuid.uuid4())
        sessions[session_id] = {
            'user_data': {},
            'context': None,
            'current_step': None
        }
    
    user_message = data['message']
    session_data = sessions[session_id]
    
    # Check if we're in the middle of a specific flow
    if session_data['context'] == 'booking_appointment':
        return handle_booking_flow(user_message, session_id)
    elif session_data['context'] == 'checking_appointment':
        return handle_checking_flow(user_message, session_id)
    elif session_data['context'] == 'cancelling_appointment':
        return handle_cancelling_flow(user_message, session_id)
    elif session_data['context'] == 'checking_symptoms':
        return handle_symptoms_flow(user_message, session_id)
    
    # Process numeric menu options if provided
    if user_message.isdigit():
        option = int(user_message)
        if option == 1:
            # Start booking appointment flow
            sessions[session_id]['context'] = 'booking_appointment'
            sessions[session_id]['current_step'] = 'name'
            return jsonify({
                'response': "Let's book an appointment. What is your full name?",
                'session_id': session_id
            })
        elif option == 2:
            # Start checking appointment flow
            sessions[session_id]['context'] = 'checking_appointment'
            sessions[session_id]['current_step'] = 'identifier'
            return jsonify({
                'response': "Please provide your email or phone number to check your appointment:",
                'session_id': session_id
            })
        elif option == 3:
            # Start cancelling appointment flow
            sessions[session_id]['context'] = 'cancelling_appointment'
            sessions[session_id]['current_step'] = 'identifier'
            return jsonify({
                'response': "Please provide your email or phone number to cancel your appointment:",
                'session_id': session_id
            })
        elif option == 4:
            # View available doctors
            doctor_info = bot.get_doctor_info("")
            return jsonify({
                'response': doctor_info,
                'session_id': session_id
            })
        elif option == 5 or option == 8:
            # Start symptoms checking flow
            sessions[session_id]['context'] = 'checking_symptoms'
            sessions[session_id]['current_step'] = 'symptoms'
            return jsonify({
                'response': "Please describe your symptoms in detail:",
                'session_id': session_id
            })
        else:
            return jsonify({
                'response': "Invalid option. Please select options 1-5 only.",
                'session_id': session_id
            })
    
    # Process natural language input
    if "book" in user_message.lower() and "appointment" in user_message.lower():
        sessions[session_id]['context'] = 'booking_appointment'
        sessions[session_id]['current_step'] = 'name'
        return jsonify({
            'response': "Let's book an appointment. What is your full name?",
            'session_id': session_id
        })
    elif "check" in user_message.lower() and "appointment" in user_message.lower():
        sessions[session_id]['context'] = 'checking_appointment'
        sessions[session_id]['current_step'] = 'identifier'
        return jsonify({
            'response': "Please provide your email or phone number to check your appointment:",
            'session_id': session_id
        })
    elif "cancel" in user_message.lower() and "appointment" in user_message.lower():
        sessions[session_id]['context'] = 'cancelling_appointment'
        sessions[session_id]['current_step'] = 'identifier'
        return jsonify({
            'response': "Please provide your email or phone number to cancel your appointment:",
            'session_id': session_id
        })
    elif "doctor" in user_message.lower() and ("available" in user_message.lower() or "list" in user_message.lower()):
        doctor_info = bot.get_doctor_info("")
        return jsonify({
            'response': doctor_info,
            'session_id': session_id
        })
    elif "symptom" in user_message.lower() or "check symptom" in user_message.lower():
        sessions[session_id]['context'] = 'checking_symptoms'
        sessions[session_id]['current_step'] = 'symptoms'
        return jsonify({
            'response': "Please describe your symptoms in detail:",
            'session_id': session_id
        })
    else:
        # Default to using the bot's AI processing
        response = bot.process_user_input(user_message)
        
        # Provide menu options if the user seems lost
        if "help" in user_message.lower() or "option" in user_message.lower() or "menu" in user_message.lower():
            response += "\n\nYou can select from the following options:\n1. Book an appointment\n2. Check my existing appointment\n3. Cancel my appointment\n4. View available doctors\n5. Check symptoms"
        
        return jsonify({
            'response': response,
            'session_id': session_id
        })

def handle_booking_flow(user_message, session_id):
    """Handle the appointment booking conversation flow"""
    session_data = sessions[session_id]
    current_step = session_data['current_step']
    user_data = session_data['user_data']
    
    if current_step == 'name':
        user_data['name'] = user_message
        session_data['current_step'] = 'email'
        return jsonify({
            'response': "What is your email address?",
            'session_id': session_id
        })
    
    elif current_step == 'email':
        # Validate email
        if not bot.validate_email(user_message):
            return jsonify({
                'response': "Please enter a valid email address.",
                'session_id': session_id
            })
        
        user_data['email'] = user_message
        session_data['current_step'] = 'phone'
        return jsonify({
            'response': "What is your mobile number? (10 digits)",
            'session_id': session_id
        })
    
    elif current_step == 'phone':
        # Validate phone
        if not bot.validate_phone(user_message):
            return jsonify({
                'response': "Please enter a valid 10-digit phone number.",
                'session_id': session_id
            })
        
        user_data['phone'] = user_message
        session_data['current_step'] = 'age'
        return jsonify({
            'response': "What is your age?",
            'session_id': session_id
        })
    
    elif current_step == 'age':
        user_data['age'] = user_message
        session_data['current_step'] = 'gender'
        return jsonify({
            'response': "What is your gender? (Male/Female/Other)",
            'session_id': session_id
        })
    
    elif current_step == 'gender':
        user_data['gender'] = user_message
        session_data['current_step'] = 'reason'
        return jsonify({
            'response': "Briefly describe the reason for your visit:",
            'session_id': session_id
        })
    
    elif current_step == 'reason':
        user_data['reason'] = user_message
        session_data['current_step'] = 'doctor'
        
        # Get list of doctors
        doctor_list = bot.doctors_data.get("doctors", [])
        
        # Format doctor information with IDs for the frontend
        doctor_info = "Please select a doctor:\n\n"
        doctor_id_mappings = []
        
        for i, doctor in enumerate(doctor_list, 1):
            doctor_info += f"{i}. Dr. {doctor['name']} ({doctor['specialty']})\n"
            doctor_id_mappings.append(f"{i}:{doctor['id']}")
        
        # Add doctor ID mappings in a format that frontend can parse
        doctor_info += f"\nDoctor IDs: {{{', '.join(doctor_id_mappings)}}}"
        
        return jsonify({
            'response': doctor_info,
            'session_id': session_id
        })
    
    elif current_step == 'doctor':
        # Check if this is a formatted message from the frontend with doctor ID
        doctor_id = None
        if user_message.startswith("DOCTOR_ID:"):
            # Format: DOCTOR_ID:doctor-id:display-name
            parts = user_message.split(':', 2)
            if len(parts) >= 2:
                doctor_id = parts[1]
                # Extract the display name for logging
                display_name = parts[2] if len(parts) > 2 else "Unknown"
                print(f"Doctor selected: ID={doctor_id}, Name={display_name}")
        
        # If no special format found, use the message as doctor ID directly
        if not doctor_id:
            doctor_id = user_message
        
        # Validate doctor selection
        if doctor_id not in bot.doctors:
            return jsonify({
                'response': "Invalid selection. Please enter a valid doctor ID.",
                'session_id': session_id
            })
        
        user_data['doctor'] = bot.doctors[doctor_id]
        user_data['doctor_id'] = doctor_id  # Store the actual doctor ID
        session_data['current_step'] = 'date'
        
        # Get available dates
        available_dates = list(bot.available_slots.keys())
        date_options = "\n".join([f"{i+1}. {date}" for i, date in enumerate(available_dates)])
        
        # Store dates for reference
        session_data['available_dates'] = available_dates
        
        return jsonify({
            'response': f"Available dates for appointment:\n{date_options}\n\nPlease select a date (enter the number):",
            'session_id': session_id
        })
    
    elif current_step == 'date':
        try:
            date_index = int(user_message) - 1
            available_dates = session_data['available_dates']
            
            if 0 <= date_index < len(available_dates):
                selected_date = available_dates[date_index]
                user_data['appointment_date'] = selected_date
                session_data['current_step'] = 'time'
                
                # Get available times for the selected date
                available_times = bot.available_slots[selected_date]
                time_options = "\n".join([f"{i+1}. {time}" for i, time in enumerate(available_times)])
                
                # Store times for reference
                session_data['available_times'] = available_times
                
                return jsonify({
                    'response': f"Available time slots for {selected_date}:\n{time_options}\n\nPlease select a time slot (enter the number):",
                    'session_id': session_id
                })
            else:
                return jsonify({
                    'response': "Invalid selection. Please enter a valid number.",
                    'session_id': session_id
                })
                
        except ValueError:
            return jsonify({
                'response': "Please enter a valid number.",
                'session_id': session_id
            })
    
    elif current_step == 'time':
        try:
            time_index = int(user_message) - 1
            available_times = session_data['available_times']
            selected_date = user_data['appointment_date']
            
            if 0 <= time_index < len(available_times):
                selected_time = available_times[time_index]
                user_data['appointment_time'] = selected_time
                
                # Remove the selected slot from available slots
                bot.available_slots[selected_date].remove(selected_time)
                
                # Save the appointment
                bot.appointments.append(user_data)
                bot.save_data(bot.appointments, bot.data_file)
                
                # Set a reminder for the appointment
                bot.set_appointment_reminder(user_data)
                
                # Clear the context
                session_data['context'] = None
                session_data['current_step'] = None
                
                # Format appointment summary
                summary = f"✅ APPOINTMENT CONFIRMED ✅\n\n"
                summary += f"Name: {user_data['name']}\n"
                summary += f"Email: {user_data['email']}\n"
                summary += f"Phone: {user_data['phone']}\n"
                summary += f"Age: {user_data['age']}\n"
                summary += f"Gender: {user_data['gender']}\n"
                summary += f"Doctor: {user_data['doctor']}\n"
                summary += f"Date: {user_data['appointment_date']}\n"
                summary += f"Time: {user_data['appointment_time']}\n"
                summary += f"Reason: {user_data['reason']}\n\n"
                
                # Add message about medical history
                summary += "Your appointment has been booked successfully.\n\n"
                summary += "You can upload your previous medical history files through the portal.\n"
                summary += "Please arrive 15 minutes before your scheduled time."
                
                # Create a copy of the appointment for the response
                appointment_data = user_data.copy()
                
                return jsonify({
                    'response': summary,
                    'session_id': session_id,
                    'appointment': appointment_data,
                    'can_upload_medical_history': True
                })
            else:
                return jsonify({
                    'response': "Invalid selection. Please enter a valid number.",
                    'session_id': session_id
                })
                
        except ValueError:
            return jsonify({
                'response': "Please enter a valid number.",
                'session_id': session_id
            })

def handle_checking_flow(user_message, session_id):
    """Handle the appointment checking conversation flow"""
    session_data = sessions[session_id]
    
    if session_data['current_step'] == 'identifier':
        # Check if it's an email or phone
        identifier_type = 'email' if '@' in user_message else 'phone'
        found_appointments = []
        
        # Look for all matching appointments
        for appointment in bot.appointments:
            if (identifier_type == 'email' and appointment.get('email') == user_message) or \
               (identifier_type == 'phone' and appointment.get('phone') == user_message):
                # Include medical history file info if available
                appointment_with_details = appointment.copy()
                
                # Check if the appointment has a medical history file
                if 'medical_history_file' in appointment:
                    file_path = appointment['medical_history_file']
                    appointment_with_details['has_medical_history'] = True
                    appointment_with_details['medical_history_file_path'] = file_path
                    appointment_with_details['medical_history_filename'] = os.path.basename(file_path)
                else:
                    appointment_with_details['has_medical_history'] = False
                
                found_appointments.append(appointment_with_details)
        
        # Clear the context
        session_data['context'] = None
        session_data['current_step'] = None
        
        if found_appointments:
            if len(found_appointments) == 1:
                # Single appointment found
                appointment = found_appointments[0]
                summary = f"Found appointment:\n\n"
                summary += f"Name: {appointment['name']}\n"
                summary += f"Doctor: {appointment['doctor']}\n"
                summary += f"Date: {appointment['appointment_date']}\n"
                summary += f"Time: {appointment['appointment_time']}\n"
                summary += f"Reason: {appointment['reason']}\n"
                
                # Add medical history file info if available
                if appointment.get('has_medical_history', False):
                    summary += f"\nMedical History File: {appointment.get('medical_history_filename', '')}\n"
                
                return jsonify({
                    'response': summary,
                    'session_id': session_id,
                    'appointment': appointment
                })
            else:
                # Multiple appointments found
                summary = f"Found {len(found_appointments)} appointments:\n\n"
                
                for i, appointment in enumerate(found_appointments, 1):
                    summary += f"--- Appointment {i} ---\n"
                    summary += f"Name: {appointment['name']}\n"
                    summary += f"Doctor: {appointment['doctor']}\n"
                    summary += f"Date: {appointment['appointment_date']}\n" 
                    summary += f"Time: {appointment['appointment_time']}\n"
                    summary += f"Reason: {appointment['reason']}\n\n"
                
                return jsonify({
                    'response': summary,
                    'session_id': session_id,
                    'appointments': found_appointments
                })
        else:
            return jsonify({
                'response': "No appointment found with the provided information.",
                'session_id': session_id
            })

def handle_cancelling_flow(user_message, session_id):
    """Handle the appointment cancellation conversation flow"""
    session_data = sessions[session_id]
    
    if session_data['current_step'] == 'identifier':
        # Check if it's an email or phone
        identifier_type = 'email' if '@' in user_message else 'phone'
        found_appointments = []
        
        # Look for all matching appointments
        for appointment in bot.appointments:
            if (identifier_type == 'email' and appointment.get('email') == user_message) or \
               (identifier_type == 'phone' and appointment.get('phone') == user_message):
                found_appointments.append(appointment)
        
        # No appointments found
        if not found_appointments:
            session_data['context'] = None
            session_data['current_step'] = None
            return jsonify({
                'response': "No appointment found with the provided information.",
                'session_id': session_id
            })
            
        # Single appointment found - cancel it
        elif len(found_appointments) == 1:
            appointment = found_appointments[0]
            bot.appointments.remove(appointment)
            bot.save_data(bot.appointments, bot.data_file)
            return jsonify({
                'success': True,
                'message': f"Appointment for {appointment['name']} has been cancelled successfully"
            })
            
        # Multiple appointments found - ask which one to cancel
        else:
            session_data['found_appointments'] = found_appointments
            session_data['current_step'] = 'select_appointment_to_cancel'
            
            response = "You have multiple appointments. Which one would you like to cancel?\n\n"
            for i, appointment in enumerate(found_appointments, 1):
                response += f"{i}. {appointment['doctor']} on {appointment['appointment_date']} at {appointment['appointment_time']}\n"
            
            return jsonify({
                'response': response,
                'session_id': session_id
            })
    
    elif session_data['current_step'] == 'select_appointment_to_cancel':
        try:
            selection = int(user_message)
            found_appointments = session_data.get('found_appointments', [])
            
            if selection < 1 or selection > len(found_appointments):
                return jsonify({
                    'response': f"Please enter a valid number between 1 and {len(found_appointments)}.",
                    'session_id': session_id
                })
            
            # Get the selected appointment
            appointment = found_appointments[selection - 1]
            
            # Remove the appointment
            bot.appointments.remove(appointment)
            bot.save_data(bot.appointments, bot.data_file)
            
            # Clear the context
            session_data['context'] = None
            session_data['current_step'] = None
            session_data.pop('found_appointments', None)
            
            return jsonify({
                'response': f"Appointment for {appointment['name']} with {appointment['doctor']} on {appointment['appointment_date']} at {appointment['appointment_time']} has been cancelled successfully.",
                'session_id': session_id
            })
            
        except ValueError:
            return jsonify({
                'response': "Please enter a valid number to select the appointment you want to cancel.",
                'session_id': session_id
            })

def handle_symptoms_flow(user_message, session_id):
    """Handle the symptoms checking conversation flow"""
    session_data = sessions[session_id]
    
    if session_data['current_step'] == 'symptoms':
        # Process the symptoms
        assessment = bot.check_symptoms(user_message)
        
        # Get recommended specialist
        recommended_specialist = getattr(bot, 'recommended_specialist', 'General Physician')
        
        # Clear the context
        session_data['context'] = None
        session_data['current_step'] = None
        
        response = f"SYMPTOM ASSESSMENT:\n\n{assessment}\n\n"
        response += f"Based on your symptoms, I recommend consulting with a {recommended_specialist}."
        
        # Get matching doctors
        matching_doctors = bot.get_specialist_doctors(recommended_specialist)
        if matching_doctors:
            doctors_list = "\n".join([f"- {doctor}" for doctor in matching_doctors])
            response += f"\n\nHere are doctors specializing in this area:\n{doctors_list}\n\n"
            response += "Would you like to book an appointment with one of these doctors? Reply with '1' to start booking."
        
        return jsonify({
            'response': response,
            'session_id': session_id,
            'assessment': assessment,
            'recommended_specialist': recommended_specialist
        })
    elif session_data['current_step'] == 'book_from_symptoms' and user_message.lower() == 'yes':
        # User confirmed they want to book with the recommended doctor
        # Set the context to booking_appointment and start from the name
        session_data['context'] = 'booking_appointment'
        session_data['current_step'] = 'name'
        
        return jsonify({
            'response': "Great! Let's book your appointment. What is your full name?",
            'session_id': session_id
        })
    else:
        # Handle response for booking question
        if user_message == '1' or user_message.lower().startswith('yes') or user_message.lower().startswith('book'):
            # Extract the first recommended doctor
            matching_doctors = bot.get_specialist_doctors(getattr(bot, 'recommended_specialist', 'General Physician'))
            if matching_doctors:
                # Store the recommended doctor in user_data
                if 'user_data' not in session_data:
                    session_data['user_data'] = {}
                    
                session_data['user_data']['doctor'] = matching_doctors[0]
                session_data['context'] = 'booking_appointment'
                session_data['current_step'] = 'name'
                
                return jsonify({
                    'response': "Great! Let's book an appointment with a specialist. What is your full name?",
                    'session_id': session_id
                })
        
        # Default to using the bot's AI processing for other responses
    response = bot.process_user_input(user_message)
    return jsonify({
        'response': response,
        'session_id': session_id
    })

@app.route('/api/welcome', methods=['GET'])
def welcome():
    """
    Welcome endpoint that provides initial greeting and creates a session
    """
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        'user_data': {},
        'context': None,
        'current_step': None
    }
    
    welcome_message = "👋 Welcome to AI HealthCare Assistant! 👋\n\n"
    welcome_message += "I'm your AI receptionist and I'm here to help you with your healthcare needs.\n\n"
    welcome_message += "When you book an appointment through chat, you'll have the option to secure it on the blockchain for additional protection.\n\n"
    welcome_message += "You can choose from the following options:\n"
    welcome_message += "1. Book an appointment\n"
    welcome_message += "2. Check my existing appointment\n"
    welcome_message += "3. Cancel my appointment\n"
    welcome_message += "4. View available doctors\n"
    welcome_message += "5. Check symptoms\n\n"
    welcome_message += "Just type the number of your choice or describe what you need in your own words."
    
    return jsonify({
        'response': welcome_message,
        'session_id': session_id
    })

@app.route('/api/book-appointment', methods=['POST'])
def book_appointment():
    """
    Endpoint to book an appointment directly
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Extract user data from request
    user_data = {
        'name': data.get('name'),
        'email': data.get('email'),
        'phone': data.get('phone'),
        'age': data.get('age'),
        'gender': data.get('gender'),
        'reason': data.get('reason'),
        'doctor': data.get('doctor'),
        'appointment_date': data.get('appointment_date'),
        'appointment_time': data.get('appointment_time')
    }
    
    # Handle medical history file if provided in base64
    if 'medical_history_file' in data:
        try:
            # Create directory if it doesn't exist
            medical_history_dir = "medical_history_files"
            if not os.path.exists(medical_history_dir):
                os.makedirs(medical_history_dir)
            
            # Get file info
            file_data = data['medical_history_file']
            if isinstance(file_data, dict) and 'file_name' in file_data and 'file_content' in file_data:
                file_name = file_data['file_name']
                file_content_base64 = file_data['file_content']
                
                # Generate unique filename
                filename = f"{user_data['name'].replace(' ', '_')}_{datetime.now().strftime('%Y%m%d%H%M%S')}{os.path.splitext(file_name)[1]}"
                destination = os.path.join(medical_history_dir, filename)
                
                # Decode and save the file
                with open(destination, 'wb') as f:
                    f.write(base64.b64decode(file_content_base64))
                
                # Add file reference to user data
                user_data['medical_history_file'] = destination
            
        except Exception as e:
            print(f"Error saving medical history file: {str(e)}")
            # Continue without the file if there's an error
    
    # Validate required fields
    required_fields = ['name', 'email', 'phone', 'doctor', 'appointment_date', 'appointment_time']
    for field in required_fields:
        if not user_data.get(field):
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Add appointment to the bot's appointments list
    bot.appointments.append(user_data)
    bot.save_data(bot.appointments, bot.data_file)
    
    # Set appointment reminder
    bot.set_appointment_reminder(user_data)
    
    return jsonify({
        'success': True,
        'message': 'Appointment booked successfully',
        'appointment': user_data
    })

@app.route('/api/check-appointment', methods=['POST'])
def check_appointment():
    """
    Endpoint to check an appointment directly
    """
    data = request.json
    if not data or ('email' not in data and 'phone' not in data):
        return jsonify({'error': 'Email or phone number is required'}), 400
    
    email = data.get('email')
    phone = data.get('phone')
    
    found_appointments = []
    
    # Look for all matching appointments
    for appointment in bot.appointments:
        if (email and appointment.get('email') == email) or \
           (phone and appointment.get('phone') == phone):
            # Include medical history file info if available
            appointment_with_details = appointment.copy()
            
            # Check if the appointment has a medical history file
            if 'medical_history_file' in appointment:
                file_path = appointment['medical_history_file']
                appointment_with_details['has_medical_history'] = True
                appointment_with_details['medical_history_file_path'] = file_path
                appointment_with_details['medical_history_filename'] = os.path.basename(file_path)
            else:
                appointment_with_details['has_medical_history'] = False
            
            found_appointments.append(appointment_with_details)
    
    if found_appointments:
        return jsonify({
            'found': True,
            'appointment_count': len(found_appointments),
            'appointments': found_appointments
        })
    else:
        return jsonify({
            'found': False,
            'message': 'No appointment found with the provided information'
        })

@app.route('/api/cancel-appointment', methods=['POST'])
def cancel_appointment():
    """
    Endpoint to cancel an appointment directly
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Check if we have appointment_id for direct cancellation
    if 'appointment_id' in data:
        appointment_id = data.get('appointment_id')
        appointment_to_cancel = None
        
        for i, appointment in enumerate(bot.appointments):
            if str(i) == str(appointment_id):
                appointment_to_cancel = appointment
                break
                
        if appointment_to_cancel:
            bot.appointments.remove(appointment_to_cancel)
            bot.save_data(bot.appointments, bot.data_file)
            return jsonify({
                'success': True,
                'message': f"Appointment for {appointment_to_cancel['name']} has been cancelled successfully"
            })
        else:
            return jsonify({
                'success': False,
                'message': 'No appointment found with the provided ID'
            })
    
    # Otherwise check by email or phone
    elif 'email' in data or 'phone' in data:
        email = data.get('email')
        phone = data.get('phone')
    
        found_appointments = []
        
        # Look for all matching appointments
        for appointment in bot.appointments:
            if (email and appointment.get('email') == email) or \
               (phone and appointment.get('phone') == phone):
                found_appointments.append(appointment)
                
        # No appointments found
        if not found_appointments:
            return jsonify({
                'success': False,
                'message': 'No appointment found with the provided information'
            })
            
        # Multiple appointments found
        elif len(found_appointments) > 1:
            return jsonify({
                'success': False,
                'message': 'Multiple appointments found. Please specify which one to cancel.',
                'appointment_count': len(found_appointments),
                'appointments': found_appointments
            })
            
        # Single appointment found - cancel it
        else:
            appointment = found_appointments[0]
            bot.appointments.remove(appointment)
            bot.save_data(bot.appointments, bot.data_file)
            return jsonify({
                'success': True,
                'message': f"Appointment for {appointment['name']} has been cancelled successfully"
            })
    else:
        return jsonify({'error': 'Email, phone, or appointment_id is required'}), 400

@app.route('/api/doctors', methods=['GET'])
def get_doctors():
    """
    Endpoint to retrieve all available doctors
    """
    return jsonify({
        'doctors': bot.doctors
    })

@app.route('/api/available-slots', methods=['GET'])
def get_available_slots():
    """
    Endpoint to retrieve all available appointment slots
    """
    return jsonify({
        'available_slots': bot.available_slots
    })

@app.route('/api/check-symptoms', methods=['POST'])
def check_symptoms():
    """
    Endpoint to analyze symptoms and provide health information
    """
    data = request.json
    if not data or 'symptoms' not in data:
        return jsonify({'error': 'No symptoms provided'}), 400
    
    symptoms = data['symptoms']
    assessment = bot.check_symptoms(symptoms)
    
    # Get recommended specialist
    recommended_specialist = getattr(bot, 'recommended_specialist', 'General Physician')
    
    return jsonify({
        'assessment': assessment,
        'recommended_specialist': recommended_specialist
    })

@app.route('/api/doctor/login', methods=['POST'])
def doctor_login():
    """
    Endpoint for doctor login
    """
    try:
        data = request.get_json()
        
        # Check if required fields are present
        if not data or 'doctor_id' not in data or 'password' not in data:
            return jsonify({
                'success': False,
                'message': 'Doctor ID and password are required'
            }), 400
        
        doctor_id = data['doctor_id']
        password = data['password']
        
        # Load doctors data
        doctors = load_doctors()
        
        # Find doctor with matching ID
        doctor = next((doc for doc in doctors if doc['id'] == doctor_id), None)
        
        if doctor and doctor['password'] == password:
            # Create session data (optional)
            session['doctor_id'] = doctor_id
            
            # Return success with doctor info (excluding password)
            doctor_info = {k: v for k, v in doctor.items() if k != 'password'}
            return jsonify({
                'success': True,
                'message': 'Login successful',
                'doctor': doctor_info
            })
        
        return jsonify({
            'success': False,
            'message': 'Invalid credentials'
        }), 401
        
    except Exception as e:
        print(f"Error in doctor login: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@app.route('/api/doctor/appointments', methods=['POST'])
def get_doctor_appointments():
    """
    Endpoint to retrieve appointments for a specific doctor
    """
    try:
        data = request.get_json()
        
        # Check if required field is present
        if not data or 'doctor_id' not in data:
            return jsonify({
                'success': False,
                'message': 'Doctor ID is required'
            }), 400
        
        doctor_id = data['doctor_id']
        
        # Load doctors data to verify the doctor exists
        doctors = load_doctors()
        doctor = next((doc for doc in doctors if doc['id'] == doctor_id), None)
        
        if not doctor:
            return jsonify({
                'success': False,
                'message': f'No doctor found with ID {doctor_id}'
            }), 404
        
        # Find doctor name
        doctor_name = doctor['name']
        
        # Find appointments for this doctor
        doctor_appointments = []
        for appointment in bot.appointments:
            if doctor_name in appointment.get('doctor', ''):
                # Include medical history file info if available
                appointment_with_details = appointment.copy()
                
                # Check if the appointment has a medical history file
                if 'medical_history_file' in appointment:
                    file_path = appointment['medical_history_file']
                    appointment_with_details['has_medical_history'] = True
                    appointment_with_details['medical_history_file_path'] = file_path
                    appointment_with_details['medical_history_filename'] = os.path.basename(file_path)
                else:
                    appointment_with_details['has_medical_history'] = False
                
                doctor_appointments.append(appointment_with_details)
        
        # Format response in a more structured way than the chatbot text output
        return jsonify({
            'success': True,
            'doctor': {
                'id': doctor_id,
                'name': doctor_name,
                'specialty': doctor['specialty']
            },
            'appointment_count': len(doctor_appointments),
            'appointments': doctor_appointments
        })
        
    except Exception as e:
        print(f"Error fetching doctor appointments: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@app.route('/api/medical-history-file/<path:filename>', methods=['GET'])
def get_medical_history_file(filename):
    """
    Serve a medical history file
    """
    try:
        # Sanitize the filename to prevent directory traversal
        filename = os.path.basename(filename)
        file_path = os.path.join('medical_history_files', filename)
        
        if not os.path.exists(file_path):
            return jsonify({
                'success': False,
                'message': 'File not found'
            }), 404
        
        # Read the file and encode it as base64
        with open(file_path, 'rb') as f:
            file_content = f.read()
            
        file_content_base64 = base64.b64encode(file_content).decode('utf-8')
        file_size = os.path.getsize(file_path)
        file_extension = os.path.splitext(filename)[1]
        
        return jsonify({
            'success': True,
            'filename': filename,
            'file_content': file_content_base64,
            'file_size': file_size,
            'file_extension': file_extension
        })
        
    except Exception as e:
        print(f"Error retrieving medical history file: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error retrieving file'
        }), 500

@app.route('/api/upload-medical-history', methods=['POST'])
def upload_medical_history():
    """
    Endpoint to upload a medical history file
    Can handle both JSON with base64 file content and direct multipart/form-data file uploads
    """
    try:
        # Check if this is a multipart/form-data file upload
        if 'file' in request.files:
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': 'No selected file'}), 400
                
            # Get session ID if provided
            session_id = request.form.get('session_id')
                
            # Create medical history directory if it doesn't exist
            medical_history_dir = "medical_history_files"
            if not os.path.exists(medical_history_dir):
                os.makedirs(medical_history_dir)
                
            # Generate unique filename
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            filename = f"medical_history_{timestamp}_{file.filename}"
            file_path = os.path.join(medical_history_dir, filename)
                
            # Save the file
            file.save(file_path)
            
            # Associate with session if provided
            if session_id and session_id in sessions:
                # Store file reference in session
                sessions[session_id]['medical_history_file'] = file_path
                
            return jsonify({
                'success': True,
                'message': 'Medical history file uploaded successfully',
                'file_path': file_path,
                'filename': filename
            })
            
        # Legacy method: JSON with base64 file content
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Required fields
        if 'appointment_identifier' not in data or 'file_data' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
            
        # Get appointment identifier (can be email, phone or appointment index)
        identifier = data['appointment_identifier']
        identifier_type = data.get('identifier_type', 'email')  # Default to email
        file_data = data['file_data']
            
        # Validate file data
        if not isinstance(file_data, dict) or 'file_name' not in file_data or 'file_content' not in file_data:
            return jsonify({'error': 'Invalid file data format'}), 400
            
        # Find the appointment
        target_appointment = None
        appointment_index = -1
            
        for i, appointment in enumerate(bot.appointments):
            if (identifier_type == 'email' and appointment.get('email') == identifier) or \
               (identifier_type == 'phone' and appointment.get('phone') == identifier) or \
               (identifier_type == 'index' and i == int(identifier)):
                target_appointment = appointment
                appointment_index = i
                break
                
        if not target_appointment:
            return jsonify({
                'success': False,
                'message': 'No appointment found with the provided identifier'
            }), 404
            
        # Create medical history directory if it doesn't exist
        medical_history_dir = "medical_history_files"
        if not os.path.exists(medical_history_dir):
            os.makedirs(medical_history_dir)
            
        # Get file info
        file_name = file_data['file_name']
        file_content_base64 = file_data['file_content']
            
        # Generate unique filename
        filename = f"{target_appointment['name'].replace(' ', '_')}_{datetime.now().strftime('%Y%m%d%H%M%S')}{os.path.splitext(file_name)[1]}"
        destination = os.path.join(medical_history_dir, filename)
            
        # Decode and save the file
        with open(destination, 'wb') as f:
            f.write(base64.b64decode(file_content_base64))
            
        # Update the appointment with file reference
        target_appointment['medical_history_file'] = destination
        bot.appointments[appointment_index] = target_appointment
        bot.save_data(bot.appointments, bot.data_file)
            
        return jsonify({
            'success': True,
            'message': 'Medical history file uploaded successfully',
            'file_path': destination,
            'filename': os.path.basename(destination)
        })
            
    except Exception as e:
        print(f"Error uploading medical history file: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error uploading file: {str(e)}'
        }), 500

@app.route('/api/send-email', methods=['POST'])
def send_email():
    """
    Endpoint to send emails via the Node.js email service
    """
    try:
        # Forward the entire request to Node.js service
        if request.files and 'attachment' in request.files:
            # Handle file upload
            attachment = request.files['attachment']
            files = {'attachment': (attachment.filename, attachment.read(), attachment.content_type)}
            
            # Forward other form data
            form_data = {
                'recipient': request.form.get('recipient'),
                'subject': request.form.get('subject'),
                'message': request.form.get('message'),
                'patientName': request.form.get('patientName'),
                'doctorName': request.form.get('doctorName')
            }
            
            response = requests.post(
                f"{NODE_EMAIL_SERVICE_URL}/api/send-email", 
                data=form_data,
                files=files
            )
        else:
            # No file attachment
            response = requests.post(
                f"{NODE_EMAIL_SERVICE_URL}/api/send-email",
                data=request.form
            )
        
        return jsonify(response.json()), response.status_code
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return jsonify({
            'success': False,
            'message': f"Error sending email: {str(e)}"
        }), 500

# ---------------------- AI Doctor API Endpoints ----------------------

@app.route('/api/ai/specialists', methods=['GET'])
def get_ai_specialists():
    """Return the list of available AI specialists"""
    logger.info("GET /api/ai/specialists request received")
    
    try:
        specialists_list = [
            {
                "id": specialist_id,
                "name": info["name"],
                "description": info["description"]
            }
            for specialist_id, info in ai_specialists.items()
        ]
        
        response = jsonify({"specialists": specialists_list})
        logger.info(f"Returning {len(specialists_list)} AI specialists")
        return response
    
    except Exception as e:
        logger.error(f"Error in get_ai_specialists: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/ai/create_session', methods=['POST'])
def create_ai_session():
    """Create a new consultation session with an AI specialist"""
    logger.info("POST /api/ai/create_session request received")
    
    try:
        data = request.json
        logger.info(f"Request data: {data}")
        
        specialist_type = data.get('specialist_type')
        
        if not specialist_type or specialist_type not in ai_specialists:
            logger.error(f"Invalid specialist type: {specialist_type}")
            return jsonify({"error": "Invalid specialist type"}), 400
        
        # Create a new session ID
        session_id = str(uuid.uuid4())
        logger.info(f"Created AI session ID: {session_id}")
        
        # Create a specialist agent for this session
        try:
            agent = create_specialist_agent(specialist_type)
            
            # Store the session
            ai_sessions[session_id] = {
                "specialist_type": specialist_type,
                "agent": agent,
                "created_at": datetime.now().isoformat(),
                "medical_records": []
            }
            
            logger.info(f"AI Session {session_id} created successfully for {specialist_type}")
            
            return jsonify({
                "session_id": session_id,
                "specialist": ai_specialists[specialist_type]["name"],
                "message": f"Session created with {ai_specialists[specialist_type]['name']}. How can I help you today?"
            })
        
        except Exception as e:
            logger.error(f"Error creating AI session: {str(e)}")
            return jsonify({"error": str(e)}), 500
            
    except Exception as e:
        logger.error(f"Unexpected error in create_ai_session: {str(e)}")
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    """Send a message to an AI doctor and get a response"""
    logger.info("POST /api/ai/chat request received")
    
    try:
        data = request.json
        if not data or 'message' not in data or 'session_id' not in data:
            logger.error("Missing required parameters")
            return jsonify({"error": "Missing required parameters"}), 400
        
        session_id = data['session_id']
        user_message = data['message']
        
        logger.info(f"AI Message: {user_message}")
        logger.info(f"AI Session ID: {session_id}")
        
        if not session_id or session_id not in ai_sessions:
            logger.error(f"Invalid AI session ID: {session_id}")
            return jsonify({"error": "Invalid session ID"}), 400
        
        try:
            session = ai_sessions[session_id]
            agent = session["agent"]
            
            # Enhance the user message to ensure comprehensive responses
            enhanced_prompt = f"""
            User query: {user_message}
            
            Please provide a comprehensive and detailed response that includes:
            1. A thorough analysis of the question or concern
            2. Detailed medical information and context relevant to the query
            3. Multiple perspectives or options when applicable
            4. Evidence-based recommendations
            5. Clear explanations of medical terminology
            
            Remember to be thorough and provide a complete analysis rather than a brief response.
            """
            
            response = agent.predict(input=enhanced_prompt)
            
            return jsonify({
                "session_id": session_id,
                "response": response
            })
        
        except Exception as e:
            logger.error(f"Error processing AI chat message: {str(e)}")
            return jsonify({"error": str(e)}), 500
            
    except Exception as e:
        logger.error(f"Unexpected error in ai_chat: {str(e)}")
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/api/ai/upload_medical_record', methods=['POST'])
def ai_upload_medical_record():
    """Upload a medical record for an AI consultation session"""
    logger.info("POST /api/ai/upload_medical_record request received")
    
    try:
        session_id = request.form.get('session_id')
        logger.info(f"AI Session ID: {session_id}")
        
        if not session_id or session_id not in ai_sessions:
            logger.error(f"Invalid AI session ID: {session_id}")
            return jsonify({"error": "Invalid session ID"}), 400
        
        if 'file' not in request.files:
            logger.error("No file part")
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            logger.error("No selected file")
            return jsonify({"error": "No selected file"}), 400
        
        try:
            # Ensure upload directory exists
            os.makedirs(app.config['AI_UPLOAD_FOLDER'], exist_ok=True)
            
            # Create a unique filename
            filename = f"{session_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
            filepath = os.path.join(app.config['AI_UPLOAD_FOLDER'], filename)
            
            # Save the file
            file.save(filepath)
            logger.info(f"File {filename} saved successfully")
            
            # Update session with medical record info
            ai_sessions[session_id]["medical_records"].append({
                "filename": filename,
                "original_name": file.filename,
                "uploaded_at": datetime.now().isoformat()
            })
            
            # Generate a comprehensive response for the uploaded file
            session = ai_sessions[session_id]
            agent = session["agent"]
            
            # Create a more detailed prompt to generate comprehensive analysis
            analysis_prompt = f"""
            I've uploaded a medical record called {file.filename}. 
            
            Please provide a comprehensive analysis including:
            1. A detailed review of the information in this document
            2. Potential implications for my health condition
            3. How this information relates to my current symptoms or condition
            4. Any recommendations for additional tests or follow-up steps
            5. Treatment options that might be relevant based on this information
            
            Please be thorough and detailed in your analysis.
            """
            
            response = agent.predict(input=analysis_prompt)
            
            return jsonify({
                "session_id": session_id,
                "filename": filename,
                "message": "Medical record uploaded successfully",
                "response": response
            })
        
        except Exception as e:
            logger.error(f"Error processing AI upload: {str(e)}")
            return jsonify({"error": str(e)}), 500
            
    except Exception as e:
        logger.error(f"Unexpected error in ai_upload_medical_record: {str(e)}")
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/api/ai/medical_records/<session_id>', methods=['GET'])
def get_ai_medical_records(session_id):
    """Get all medical records for an AI session"""
    logger.info(f"GET /api/ai/medical_records/{session_id} request received")
    
    try:
        if not session_id or session_id not in ai_sessions:
            logger.error(f"Invalid AI session ID: {session_id}")
            return jsonify({"error": "Invalid session ID"}), 400
        
        return jsonify({
            "session_id": session_id,
            "medical_records": ai_sessions[session_id]["medical_records"]
        })
        
    except Exception as e:
        logger.error(f"Error retrieving AI medical records: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/ai/uploads/<filename>', methods=['GET'])
def get_ai_uploaded_file(filename):
    """Serve an uploaded file for AI doctor"""
    logger.info(f"GET /api/ai/uploads/{filename} request received")
    return send_from_directory(app.config['AI_UPLOAD_FOLDER'], filename)

@app.route('/api/ai/health', methods=['GET'])
def ai_health_check():
    """Simple health check endpoint for AI doctor"""
    logger.info("AI health check request received")
    return jsonify({"status": "ok", "message": "AI Doctor API is running"})

if __name__ == '__main__':
    logger.info("Starting Healthcare App server with AI Doctor integration")
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True) 