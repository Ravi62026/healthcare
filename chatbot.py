import os
import json
import time
import re
import datetime
from datetime import datetime, timedelta
import random
import colorama
from colorama import Fore, Style
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferMemory
from langchain.tools import Tool
from langchain.agents import AgentExecutor, create_react_agent
from langchain_community.tools.tavily_search import TavilySearchResults
from dotenv import load_dotenv
import threading

# Add rich text formatting libraries
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich import print as rprint

# Initialize colorama for cross-platform colored output
colorama.init()

# Initialize rich console
console = Console()

# Load environment variables
load_dotenv()

class HealthcareBot:
    def __init__(self):
        self.data_file = "appointments.json"
        self.medical_history_file = "medical_history.json"
        self.medications_file = "medications.json"
        self.doctors_file = "doctor.json"
        self.appointments = self.load_data(self.data_file)
        self.medical_history = self.load_data(self.medical_history_file)
        self.medications = self.load_data(self.medications_file)
        self.doctors_data = self.load_data(self.doctors_file)
        self.user_data = {}
        self.available_slots = self.generate_available_slots()
        self.doctors = self.load_doctors()
        
        # Initialize AI components
        google_api_key = os.getenv("GOOGLE_API_KEY")
        try:
            if not google_api_key or google_api_key == "your_api_key_here":
                print(Fore.YELLOW + "Warning: No valid Google API key found. Some AI features will be limited." + Style.RESET_ALL)
                self.llm = None
            else:
                self.llm = ChatGoogleGenerativeAI(
                    model="gemini-2.0-flash",
                    google_api_key=google_api_key,
                    temperature=0.7
                )
        except Exception as e:
            print(Fore.RED + f"Error initializing Google AI: {str(e)}" + Style.RESET_ALL)
            self.llm = None
        
        # Initialize conversation memory
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True
        )
        
        # Define tools for the agent
        self.tools = [
            Tool(
                name="BookAppointment",
                func=self.book_appointment,
                description="Book a new appointment with a doctor"
            ),
            Tool(
                name="CheckAppointment",
                func=self.check_appointment,
                description="Check existing appointment details"
            ),
            Tool(
                name="CancelAppointment",
                func=self.cancel_appointment,
                description="Cancel an existing appointment"
            ),
            Tool(
                name="GetDoctorInfo",
                func=self.get_doctor_info,
                description="Get information about available doctors"
            ),
            Tool(
                name="GetAvailableSlots",
                func=self.get_available_slots,
                description="Get available appointment slots"
            ),
            Tool(
                name="SearchHealthInfo",
                func=self.search_health_info,
                description="Search for general health information"
            ),
            Tool(
                name="GetContactInfo",
                func=self.get_contact_info,
                description="Get healthcare facility contact information"
            ),
            Tool(
                name="CheckSymptoms",
                func=self.check_symptoms,
                description="Check symptoms and get preliminary assessment"
            ),
            Tool(
                name="AddMedicalHistory",
                func=self.add_medical_history,
                description="Add information to patient's medical history"
            ),
            Tool(
                name="GetMedicalHistory",
                func=self.get_medical_history,
                description="Retrieve patient's medical history"
            ),
            Tool(
                name="AddMedication",
                func=self.add_medication,
                description="Add medication to patient's medication list"
            ),
            Tool(
                name="GetMedications",
                func=self.get_medications,
                description="Retrieve patient's medication list"
            ),
            Tool(
                name="SetReminder",
                func=self.set_reminder,
                description="Set a reminder for medication or appointment"
            ),
            Tool(
                name="GetDoctorAppointments",
                func=self.get_doctor_appointments,
                description="Get appointments for a specific doctor"
            )
        ]
        
        # Create the agent
        self.agent = self.create_agent()
        
        # Start reminder checker thread
        self.reminder_thread = threading.Thread(target=self.check_reminders, daemon=True)
        self.reminder_thread.start()

    def load_data(self, filename):
        if os.path.exists(filename):
            try:
                with open(filename, 'r') as file:
                    return json.load(file)
            except json.JSONDecodeError:
                return [] if filename != self.doctors_file else {"doctors": []}
        else:
            return [] if filename != self.doctors_file else {"doctors": []}

    def load_doctors(self):
        """Load doctors from doctor.json file"""
        doctors_dict = {}
        if "doctors" in self.doctors_data:
            for doctor in self.doctors_data["doctors"]:
                doctors_dict[doctor["id"]] = f"{doctor['name']} ({doctor['specialty']})"
        return doctors_dict

    def save_data(self, data, filename):
        with open(filename, 'w') as file:
            json.dump(data, file, indent=4)

    def create_agent(self):
        # If LLM is not available, return None
        if self.llm is None:
            return None
            
        # Define the prompt template for the agent
        prompt = PromptTemplate.from_template(
            """You are an AI healthcare receptionist assistant. Your job is to help patients with their healthcare needs.
            
            You have access to the following tools:
            {tools}
            
            Use the following format:
            
            Question: the input question you must answer
            Thought: you should always think about what to do
            Action: the action to take, should be one of [{tool_names}]
            Action Input: the input to the action
            Observation: the result of the action
            ... (this Thought/Action/Action Input/Observation can repeat N times)
            Thought: I now know the final answer
            Final Answer: the final answer to the original input question
            
            Previous conversation history:
            {chat_history}
            
            Question: {input}
            {agent_scratchpad}"""
        )
        
        # Create the agent
        agent = create_react_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=prompt
        )
        
        # Create the agent executor
        agent_executor = AgentExecutor(
            agent=agent,
            tools=self.tools,
            memory=self.memory,
            verbose=True
        )
        
        return agent_executor

    def generate_available_slots(self):
        slots = {}
        # Generate slots for next 7 days
        for i in range(7):
            date = (datetime.now() + timedelta(days=i+1)).strftime("%Y-%m-%d")
            slots[date] = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
        return slots

    def clear_screen(self):
        os.system('cls' if os.name == 'nt' else 'clear')

    def typing_effect(self, text, color=Fore.WHITE):
        for char in text:
            print(color + char, end='', flush=True)
            time.sleep(0.01)
        print(Style.RESET_ALL)
        
    def rich_print(self, text, style=None, markdown=False):
        """Print text with rich formatting"""
        if markdown:
            console.print(Markdown(text))
        else:
            console.print(text, style=style)
            
    def rich_panel(self, title, content, style=None):
        """Display content in a rich panel"""
        console.print(Panel(content, title=title, style=style))
        
    def rich_table(self, title, columns, rows):
        """Display data in a rich table"""
        table = Table(title=title)
        for column in columns:
            table.add_column(column)
        for row in rows:
            table.add_row(*row)
        console.print(table)
        
    def format_markdown(self, text):
        """Format text as markdown for better display"""
        # Check if text contains markdown-like patterns
        if any(md in text for md in ['#', '**', '*', '`', '>', '- ', '1. ', '```']):
            return Markdown(text)
        return text

    def validate_email(self, email):
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None

    def validate_phone(self, phone):
        pattern = r'^\d{10}$'
        return re.match(pattern, phone) is not None

    def get_input(self, prompt, validation_func=None, error_message=None, color=Fore.CYAN):
        while True:
            self.typing_effect(prompt, color)
            user_input = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
            
            if validation_func is None or validation_func(user_input):
                return user_input
            else:
                self.typing_effect(error_message, Fore.RED)

    def select_doctor(self):
        self.typing_effect("\nPlease select a doctor from the following list:", Fore.CYAN)
        for key, doctor in self.doctors.items():
            self.typing_effect(f"{key}. {doctor}", Fore.YELLOW)
        
        while True:
            choice = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
            if choice in self.doctors:
                return self.doctors[choice]
            else:
                self.typing_effect("Invalid choice. Please select a valid option.", Fore.RED)

    def select_date_time(self):
        self.typing_effect("\nAvailable dates for appointment:", Fore.CYAN)
        dates = list(self.available_slots.keys())
        for i, date in enumerate(dates, 1):
            self.typing_effect(f"{i}. {date}", Fore.YELLOW)
        
        date_index = 0
        while True:
            try:
                self.typing_effect("Please select a date (enter the number):", Fore.CYAN)
                date_index = int(input(Fore.GREEN + "> " + Style.RESET_ALL).strip()) - 1
                if 0 <= date_index < len(dates):
                    selected_date = dates[date_index]
                    break
                else:
                    self.typing_effect("Invalid selection. Please try again.", Fore.RED)
            except ValueError:
                self.typing_effect("Please enter a valid number.", Fore.RED)
        
        selected_date = dates[date_index]
        self.typing_effect(f"\nAvailable time slots for {selected_date}:", Fore.CYAN)
        for i, time_slot in enumerate(self.available_slots[selected_date], 1):
            self.typing_effect(f"{i}. {time_slot}", Fore.YELLOW)
        
        while True:
            try:
                self.typing_effect("Please select a time slot (enter the number):", Fore.CYAN)
                time_index = int(input(Fore.GREEN + "> " + Style.RESET_ALL).strip()) - 1
                if 0 <= time_index < len(self.available_slots[selected_date]):
                    selected_time = self.available_slots[selected_date][time_index]
                    # Remove the selected slot from available slots
                    self.available_slots[selected_date].remove(selected_time)
                    return selected_date, selected_time
                else:
                    self.typing_effect("Invalid selection. Please try again.", Fore.RED)
            except ValueError:
                self.typing_effect("Please enter a valid number.", Fore.RED)

    def collect_user_info(self):
        self.clear_screen()
        self.rich_panel("📋 REGISTRATION FORM 📋", "Please provide your information below", style="cyan")
        
        self.user_data["name"] = self.get_input("\nWhat is your full name?")
        self.user_data["email"] = self.get_input(
            "What is your email address?", 
            self.validate_email, 
            "Please enter a valid email address."
        )
        self.user_data["phone"] = self.get_input(
            "What is your mobile number? (10 digits)",
            self.validate_phone,
            "Please enter a valid 10-digit phone number."
        )
        self.user_data["age"] = self.get_input("What is your age?")
        self.user_data["gender"] = self.get_input("What is your gender? (Male/Female/Other)")
        self.user_data["reason"] = self.get_input("Briefly describe the reason for your visit:")
        self.user_data["doctor"] = self.select_doctor()
        date, time_slot = self.select_date_time()
        self.user_data["appointment_date"] = date
        self.user_data["appointment_time"] = time_slot
        
        return self.user_data

    def display_appointment_summary(self):
        self.clear_screen()
        self.rich_panel("✅ APPOINTMENT CONFIRMED ✅", "Your appointment details are below", style="green")
        
        # Create a table for appointment details
        appointment_data = [
            ["Name", self.user_data['name']],
            ["Email", self.user_data['email']],
            ["Phone", self.user_data['phone']],
            ["Age", self.user_data['age']],
            ["Gender", self.user_data['gender']],
            ["Doctor", self.user_data['doctor']],
            ["Date", self.user_data['appointment_date']],
            ["Time", self.user_data['appointment_time']],
            ["Reason", self.user_data['reason']]
        ]
        
        # Add medical history file info if it exists
        if 'medical_history_file' in self.user_data:
            appointment_data.append(["Medical History", self.user_data['medical_history_file']])
            
        self.rich_table("Appointment Details", ["Field", "Value"], appointment_data)
        
        self.rich_panel("Additional Information", 
                        "Thank you for booking an appointment with our healthcare system!\n\n"
                        "Please arrive 15 minutes before your scheduled time.\n"
                        "A confirmation has been saved to your records.", 
                        style="green")
        
        # Set a reminder for the appointment
        self.set_appointment_reminder(self.user_data)

    def check_existing_appointments(self, email=None, phone=None):
        if not email and not phone:
            return None
            
        for appointment in self.appointments:
            if (email and appointment.get("email") == email) or \
               (phone and appointment.get("phone") == phone):
                return appointment
        return None

    def show_existing_appointment(self, appointment):
        self.clear_screen()
        self.rich_panel("🔍 EXISTING APPOINTMENT FOUND 🔍", "Your appointment details are below", style="green")
        
        # Create a table for appointment details
        appointment_data = [
            ["Name", appointment['name']],
            ["Doctor", appointment['doctor']],
            ["Date", appointment['appointment_date']],
            ["Time", appointment['appointment_time']]
        ]
        self.rich_table("Appointment Details", ["Field", "Value"], appointment_data)
        
        self.typing_effect("\nWould you like to:", Fore.CYAN)
        self.typing_effect("1. Keep this appointment", Fore.YELLOW)
        self.typing_effect("2. Cancel this appointment", Fore.YELLOW)
        self.typing_effect("3. Book a new appointment", Fore.YELLOW)
        
        choice = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
        if choice == "2":
            self.appointments.remove(appointment)
            self.save_data(self.appointments, self.data_file)
            self.typing_effect("Your appointment has been cancelled successfully.", Fore.GREEN)
            return "cancelled"
        elif choice == "3":
            return "new"
        else:
            return "keep"

    # AI Agent Tool Functions
    def book_appointment(self, query):
        """Book a new appointment with a doctor"""
        try:
            user_data = self.collect_user_info()
            
            # Ask about medical history
            self.typing_effect("\nWould you like to upload your previous medical history? (yes/no)", Fore.YELLOW)
            upload_choice = input(Fore.GREEN + "> " + Style.RESET_ALL).strip().lower()
            
            if upload_choice in ["yes", "y"]:
                # Create medical history directory if it doesn't exist
                medical_history_dir = "medical_history_files"
                if not os.path.exists(medical_history_dir):
                    os.makedirs(medical_history_dir)
                
                self.typing_effect("\nPlease enter the path to your medical history file:", Fore.CYAN)
                file_path = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                
                if os.path.exists(file_path):
                    # Generate a unique filename based on user's name and timestamp
                    filename = f"{user_data['name'].replace(' ', '_')}_{datetime.now().strftime('%Y%m%d%H%M%S')}{os.path.splitext(file_path)[1]}"
                    destination = os.path.join(medical_history_dir, filename)
                    
                    # Copy the file
                    import shutil
                    shutil.copy2(file_path, destination)
                    
                    # Add file reference to user data
                    user_data['medical_history_file'] = destination
                    self.typing_effect(f"\nMedical history file saved as: {destination}", Fore.GREEN)
                else:
                    self.typing_effect("\nFile not found. Continuing without uploading medical history.", Fore.RED)
            
            self.appointments.append(user_data)
            self.save_data(self.appointments, self.data_file)
            self.display_appointment_summary()
            
            # Ask if user wants to exit after booking
            self.typing_effect("\nWould you like to exit the application? (yes/no)", Fore.YELLOW)
            exit_choice = input(Fore.GREEN + "> " + Style.RESET_ALL).strip().lower()
            
            if exit_choice in ["yes", "y"]:
                self.typing_effect("Thank you for using our AI Healthcare Assistant. Have a healthy day!", Fore.GREEN)
                return "exit"
            
            return "Appointment booked successfully."
        except Exception as e:
            return f"Error booking appointment: {str(e)}"

    def check_appointment(self, query):
        """Check existing appointment details"""
        # Extract email or phone from the query using AI
        prompt = f"""
        Extract the email address or phone number from the following query:
        {query}
        
        Return ONLY the email or phone number, nothing else.
        """
        
        extracted_info = self.llm.invoke(prompt).content.strip()
        
        if "@" in extracted_info:  # It's an email
            appointment = self.check_existing_appointments(email=extracted_info)
        else:  # Assume it's a phone number
            appointment = self.check_existing_appointments(phone=extracted_info)
            
        if appointment:
            return f"Found appointment: {appointment['name']} with {appointment['doctor']} on {appointment['appointment_date']} at {appointment['appointment_time']}"
        else:
            return "No appointment found with the provided information."

    def cancel_appointment(self, query):
        """Cancel an existing appointment"""
        # Extract email or phone from the query using AI
        prompt = f"""
        Extract the email address or phone number from the following query:
        {query}
        
        Return ONLY the email or phone number, nothing else.
        """
        
        extracted_info = self.llm.invoke(prompt).content.strip()
        
        if "@" in extracted_info:  # It's an email
            appointment = self.check_existing_appointments(email=extracted_info)
        else:  # Assume it's a phone number
            appointment = self.check_existing_appointments(phone=extracted_info)
            
        if appointment:
            self.appointments.remove(appointment)
            self.save_data(self.appointments, self.data_file)
            return f"Appointment for {appointment['name']} has been cancelled successfully."
        else:
            return "No appointment found with the provided information."

    def get_doctor_info(self, query):
        """Get information about available doctors"""
        doctor_info = "Here are our available doctors:\n"
        for key, doctor in self.doctors.items():
            doctor_info += f"{key}. {doctor}\n"
        return doctor_info

    def get_available_slots(self, query):
        """Get available appointment slots"""
        slots_info = "Available appointment slots:\n"
        for date, times in self.available_slots.items():
            slots_info += f"{date}: {', '.join(times)}\n"
        return slots_info

    def search_health_info(self, query):
        """Search for general health information"""
        # Use Tavily search to find health information
        search = TavilySearchResults(max_results=3)
        results = search.invoke(query)
        
        # Format the results
        formatted_results = "Here's what I found:\n\n"
        for i, result in enumerate(results, 1):
            formatted_results += f"{i}. {result['title']}\n"
            formatted_results += f"   {result['snippet']}\n\n"
            formatted_results += f"   Source: {result['url']}\n\n"
            
        return formatted_results

    def get_contact_info(self, query):
        """Get healthcare facility contact information"""
        contact_info = """
        📞 Phone: 1-800-HEALTH
        📧 Email: support@healthcare.example
        ⏰ Hours: Mon-Fri 8am-8pm, Sat-Sun 10am-4pm
        
        📍 Address:
        123 Health Street
        Medical District, City
        ZIP: 12345
        
        🚗 Parking: Available in the adjacent parking garage
        
        🚑 Emergency: For medical emergencies, please call 911 or visit our 24/7 emergency department at the rear entrance.
        """
        
        return contact_info
        
    def check_symptoms(self, query):
        """Check symptoms and provide preliminary assessment"""
        if not query:
            return "Please provide symptoms to check."
            
        if self.llm is None:
            self.recommended_specialist = "General Physician"
            return "AI-powered symptom analysis is not available. Please consult with a General Physician for a proper diagnosis."
        
        try:
            # Use AI to analyze symptoms and provide preliminary assessment
            prompt = f"""
            As a healthcare AI assistant, analyze the following symptoms and provide a preliminary assessment:
            
            {query}
            
            Please provide:
            1. Possible conditions
            2. Severity assessment (mild, moderate, severe)
            3. Recommended next steps
            4. Whether immediate medical attention is needed
            5. Recommended specialist type (e.g., Cardiologist, Dermatologist, etc.)
            
            Format your response in a clear, structured way.
            """
            
            assessment = self.llm.invoke(prompt).content
            
            # Extract recommended specialist from the assessment
            specialist_prompt = f"""
            Based on the following assessment, extract ONLY the recommended specialist type:
            
            {assessment}
            
            Return ONLY the specialist type (e.g., Cardiologist, Dermatologist, etc.) or "General Physician" if no specific specialist is mentioned.
            """
            
            recommended_specialist = self.llm.invoke(specialist_prompt).content.strip()
            
            # Store the recommended specialist for later use
            self.recommended_specialist = recommended_specialist
            
            return assessment
        except Exception as e:
            return f"Error checking symptoms: {str(e)}"
        
    def get_specialist_doctors(self, specialist_type):
        """Get doctors of a specific specialty"""
        matching_doctors = []
        
        # Find matching doctors based on specialty
        specialist_type_lower = specialist_type.lower()
        for doctor in self.doctors_data["doctors"]:
            if specialist_type_lower in doctor["specialty"].lower():
                matching_doctors.append(f"{doctor['name']} ({doctor['specialty']})")
        
        # If no matches found, return all doctors
        if not matching_doctors:
            return list(self.doctors.values())
            
        return matching_doctors
        
    def add_medical_history(self, query):
        """Add information to patient's medical history"""
        # Extract patient identifier and medical information
        prompt = f"""
        Extract the following information from the query:
        1. Patient identifier (email or phone)
        2. Medical condition or procedure
        3. Date (if mentioned)
        4. Additional details
        
        Query: {query}
        
        Format as JSON with keys: identifier, condition, date, details
        """
        
        try:
            extracted_info = self.llm.invoke(prompt).content
            # Parse the JSON response
            import json
            info = json.loads(extracted_info)
            
            # Find or create patient record
            patient_record = None
            for record in self.medical_history:
                if record.get("identifier") == info["identifier"]:
                    patient_record = record
                    break
                    
            if not patient_record:
                patient_record = {
                    "identifier": info["identifier"],
                    "history": []
                }
                self.medical_history.append(patient_record)
                
            # Add the new entry
            entry = {
                "condition": info["condition"],
                "date": info.get("date", datetime.now().strftime("%Y-%m-%d")),
                "details": info.get("details", "")
            }
            
            patient_record["history"].append(entry)
            self.save_data(self.medical_history, self.medical_history_file)
            
            return f"Medical history updated for patient with identifier {info['identifier']}."
        except Exception as e:
            return f"Error updating medical history: {str(e)}"
            
    def get_medical_history(self, query):
        """Retrieve patient's medical history"""
        # Extract patient identifier
        prompt = f"""
        Extract the email address or phone number from the following query:
        {query}
        
        Return ONLY the email or phone number, nothing else.
        """
        
        extracted_info = self.llm.invoke(prompt).content.strip()
        
        # Find patient record
        patient_record = None
        for record in self.medical_history:
            if record.get("identifier") == extracted_info:
                patient_record = record
                break
                
        if patient_record and patient_record.get("history"):
            history_text = f"Medical history for patient with identifier {extracted_info}:\n\n"
            for entry in patient_record["history"]:
                history_text += f"Condition: {entry['condition']}\n"
                history_text += f"Date: {entry['date']}\n"
                history_text += f"Details: {entry['details']}\n\n"
            return history_text
        else:
            return f"No medical history found for patient with identifier {extracted_info}."
            
    def add_medication(self, query):
        """Add medication to patient's medication list"""
        # Extract patient identifier and medication information
        prompt = f"""
        Extract the following information from the query:
        1. Patient identifier (email or phone)
        2. Medication name
        3. Dosage
        4. Frequency
        5. Start date (if mentioned)
        6. End date (if mentioned)
        
        Query: {query}
        
        Format as JSON with keys: identifier, medication, dosage, frequency, start_date, end_date
        """
        
        try:
            extracted_info = self.llm.invoke(prompt).content
            # Parse the JSON response
            import json
            info = json.loads(extracted_info)
            
            # Find or create patient record
            patient_record = None
            for record in self.medications:
                if record.get("identifier") == info["identifier"]:
                    patient_record = record
                    break
                    
            if not patient_record:
                patient_record = {
                    "identifier": info["identifier"],
                    "medications": []
                }
                self.medications.append(patient_record)
                
            # Add the new medication
            medication = {
                "name": info["medication"],
                "dosage": info.get("dosage", ""),
                "frequency": info.get("frequency", ""),
                "start_date": info.get("start_date", datetime.now().strftime("%Y-%m-%d")),
                "end_date": info.get("end_date", "")
            }
            
            patient_record["medications"].append(medication)
            self.save_data(self.medications, self.medications_file)
            
            # Set a reminder for the medication
            self.set_medication_reminder(info["identifier"], medication)
            
            return f"Medication added for patient with identifier {info['identifier']}."
        except Exception as e:
            return f"Error adding medication: {str(e)}"
            
    def get_medications(self, query):
        """Retrieve patient's medication list"""
        # Extract patient identifier
        prompt = f"""
        Extract the email address or phone number from the following query:
        {query}
        
        Return ONLY the email or phone number, nothing else.
        """
        
        extracted_info = self.llm.invoke(prompt).content.strip()
        
        # Find patient record
        patient_record = None
        for record in self.medications:
            if record.get("identifier") == extracted_info:
                patient_record = record
                break
                
        if patient_record and patient_record.get("medications"):
            medications_text = f"Medications for patient with identifier {extracted_info}:\n\n"
            for med in patient_record["medications"]:
                medications_text += f"Medication: {med['name']}\n"
                medications_text += f"Dosage: {med['dosage']}\n"
                medications_text += f"Frequency: {med['frequency']}\n"
                medications_text += f"Start Date: {med['start_date']}\n"
                if med.get("end_date"):
                    medications_text += f"End Date: {med['end_date']}\n"
                medications_text += "\n"
            return medications_text
        else:
            return f"No medications found for patient with identifier {extracted_info}."
            
    def set_reminder(self, query):
        """Set a reminder for medication or appointment"""
        # Extract reminder details
        prompt = f"""
        Extract the following information from the query:
        1. Reminder type (appointment or medication)
        2. Patient identifier (email or phone)
        3. Date and time
        4. Additional details
        
        Query: {query}
        
        Format as JSON with keys: type, identifier, datetime, details
        """
        
        try:
            extracted_info = self.llm.invoke(prompt).content
            # Parse the JSON response
            import json
            info = json.loads(extracted_info)
            
            # Create reminder
            reminder = {
                "type": info["type"],
                "identifier": info["identifier"],
                "datetime": info["datetime"],
                "details": info.get("details", ""),
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
            # Add to reminders list
            if not hasattr(self, "reminders"):
                self.reminders = []
                
            self.reminders.append(reminder)
            
            return f"Reminder set for {info['type']} on {info['datetime']}."
        except Exception as e:
            return f"Error setting reminder: {str(e)}"
            
    def set_appointment_reminder(self, appointment_data):
        """Set a reminder for an appointment"""
        # Create reminder for 1 day before
        appointment_date = datetime.strptime(appointment_data["appointment_date"], "%Y-%m-%d")
        reminder_date = appointment_date - timedelta(days=1)
        
        reminder = {
            "type": "appointment",
            "identifier": appointment_data["email"],
            "datetime": reminder_date.strftime("%Y-%m-%d %H:%M:%S"),
            "details": f"Appointment with {appointment_data['doctor']} tomorrow at {appointment_data['appointment_time']}",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # Add to reminders list
        if not hasattr(self, "reminders"):
            self.reminders = []
            
        self.reminders.append(reminder)
        
    def set_medication_reminder(self, identifier, medication):
        """Set a reminder for medication"""
        # Create daily reminder based on frequency
        frequency = medication["frequency"].lower()
        
        if "daily" in frequency or "once" in frequency:
            # Set reminder for today
            reminder_date = datetime.now()
            
            reminder = {
                "type": "medication",
                "identifier": identifier,
                "datetime": reminder_date.strftime("%Y-%m-%d %H:%M:%S"),
                "details": f"Take {medication['name']} - {medication['dosage']}",
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
            # Add to reminders list
            if not hasattr(self, "reminders"):
                self.reminders = []
                
            self.reminders.append(reminder)
            
    def check_reminders(self):
        """Check for due reminders"""
        while True:
            now = datetime.now()
            
            if hasattr(self, "reminders"):
                for reminder in self.reminders[:]:  # Copy list to avoid modification during iteration
                    reminder_time = datetime.strptime(reminder["datetime"], "%Y-%m-%d %H:%M:%S")
                    
                    # If reminder is due
                    if now >= reminder_time:
                        # Display reminder
                        self.typing_effect(f"\n🔔 REMINDER: {reminder['details']}", Fore.YELLOW)
                        
                        # Remove the reminder
                        self.reminders.remove(reminder)
            
            # Check every minute
            time.sleep(60)
            
    def get_doctor_appointments(self, query):
        """Get appointments for a specific doctor"""
        # Extract doctor ID from the query
        prompt = f"""
        Extract the doctor ID from the following query:
        {query}
        
        Return ONLY the doctor ID, nothing else.
        """
        
        doctor_id = self.llm.invoke(prompt).content.strip()
        
        # Find doctor name
        doctor_name = None
        for doctor in self.doctors_data["doctors"]:
            if doctor["id"] == doctor_id:
                doctor_name = doctor["name"]
                break
                
        if not doctor_name:
            return f"No doctor found with ID {doctor_id}."
            
        # Find appointments for this doctor
        doctor_appointments = []
        for appointment in self.appointments:
            if doctor_name in appointment.get("doctor", ""):
                doctor_appointments.append(appointment)
                
        if not doctor_appointments:
            return f"No appointments found for Dr. {doctor_name}."
            
        # Format the appointments
        appointments_text = f"Appointments for Dr. {doctor_name}:\n\n"
        for i, appointment in enumerate(doctor_appointments, 1):
            appointments_text += f"{i}. Patient: {appointment['name']}\n"
            appointments_text += f"   Date: {appointment['appointment_date']}\n"
            appointments_text += f"   Time: {appointment['appointment_time']}\n"
            appointments_text += f"   Reason: {appointment['reason']}\n\n"
            
        return appointments_text
            
    def process_user_input(self, user_input):
        """Process user input and generate a response"""
        if self.agent is None:
            # Fallback to basic responses when AI is not available
            if "book" in user_input.lower() and "appointment" in user_input.lower():
                return "To book an appointment, please select option 1 from the main menu."
            elif "check" in user_input.lower() and "appointment" in user_input.lower():
                return "To check your appointment, please select option 2 from the main menu."
            elif "cancel" in user_input.lower() and "appointment" in user_input.lower():
                return "To cancel an appointment, please select option 3 from the main menu."
            elif "doctor" in user_input.lower():
                return self.get_doctor_info("")
            elif "symptom" in user_input.lower():
                return "To check symptoms, please select option 5 from the main menu."
            else:
                return "I'm operating in limited mode without AI features. Please select an option from the menu or try again later when full functionality is restored."
        
        try:
            return self.agent.invoke({"input": user_input})["output"]
        except Exception as e:
            print(f"Error in agent processing: {str(e)}")
            return "I'm sorry, I encountered an error processing your request. Please try again."

    def start(self):
        self.clear_screen()
        self.rich_panel("👋 Welcome to AI HealthCare Assistant! 👋", 
                        "I'm your AI receptionist and I'm here to help you with your healthcare needs.\n\n"
                        "You can ask me to book appointments, check existing appointments, cancel appointments, or ask general health questions.", 
                        style="cyan")
        
        while True:
            self.rich_panel("How can I assist you today?", 
                           "Type 'exit' to quit or select an option below", 
                           style="cyan")
            
            # Create a table for options
            options_data = [
                ["1", "Book an appointment"],
                ["2", "Check my existing appointment"],
                ["3", "Cancel my appointment"],
                ["4", "View available doctors"],
                ["5", "Check available appointment slots"],
                ["6", "Get health information"],
                ["7", "Contact information"],
                ["8", "Check symptoms"],
                ["9", "Manage medical history"],
                ["10", "Manage medications"],
                ["11", "View doctor appointments"]
            ]
            self.rich_table("Available Options", ["Option", "Description"], options_data)
            
            self.typing_effect("\nYou can also type your question directly.", Fore.CYAN)
            
            user_input = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
            
            if user_input.lower() in ["exit", "quit", "bye"]:
                self.typing_effect("Thank you for using our AI Healthcare Assistant. Have a healthy day!", Fore.GREEN)
                break
            
            # Handle numeric options
            if user_input.isdigit():
                option = int(user_input)
                if option == 1:
                    user_input = "I'd like to book an appointment with a doctor"
                elif option == 2:
                    self.typing_effect("Please provide your email or phone number:", Fore.CYAN)
                    contact_info = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                    user_input = f"Check my appointment with {contact_info}"
                elif option == 3:
                    self.typing_effect("Please provide your email or phone number:", Fore.CYAN)
                    contact_info = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                    user_input = f"Cancel my appointment with {contact_info}"
                elif option == 4:
                    user_input = "What doctors are available?"
                elif option == 5 or option == 8:
                    self.typing_effect("Please describe your symptoms:", Fore.CYAN)
                    symptoms = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                    user_input = f"Check these symptoms: {symptoms}"
                elif option == 6:
                    self.typing_effect("What health information would you like to know about?", Fore.CYAN)
                    health_query = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                    user_input = f"Tell me about {health_query}"
                elif option == 7:
                    user_input = "What is your contact information?"
                elif option == 9:
                    self.typing_effect("What would you like to do with your medical history?", Fore.CYAN)
                    self.typing_effect("1. View my medical history", Fore.YELLOW)
                    self.typing_effect("2. Add to my medical history", Fore.YELLOW)
                    history_choice = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                    
                    if history_choice == "1":
                        self.typing_effect("Please provide your email or phone number:", Fore.CYAN)
                        contact_info = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                        user_input = f"Show my medical history with identifier {contact_info}"
                    elif history_choice == "2":
                        self.typing_effect("Please provide your email or phone number:", Fore.CYAN)
                        contact_info = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                        self.typing_effect("What medical condition or procedure would you like to add?", Fore.CYAN)
                        condition = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                        self.typing_effect("When did this occur? (YYYY-MM-DD or 'today')", Fore.CYAN)
                        date = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                        if date.lower() == "today":
                            date = datetime.now().strftime("%Y-%m-%d")
                        self.typing_effect("Any additional details?", Fore.CYAN)
                        details = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                        user_input = f"Add to medical history: identifier {contact_info}, condition {condition}, date {date}, details {details}"
                elif option == 10:
                    self.typing_effect("What would you like to do with your medications?", Fore.CYAN)
                    self.typing_effect("1. View my medications", Fore.YELLOW)
                    self.typing_effect("2. Add a medication", Fore.YELLOW)
                    med_choice = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                    
                    if med_choice == "1":
                        self.typing_effect("Please provide your email or phone number:", Fore.CYAN)
                        contact_info = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                        user_input = f"Show my medications with identifier {contact_info}"
                    elif med_choice == "2":
                        self.typing_effect("Please provide your email or phone number:", Fore.CYAN)
                        contact_info = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                        self.typing_effect("What medication would you like to add?", Fore.CYAN)
                        medication = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                        self.typing_effect("What is the dosage?", Fore.CYAN)
                        dosage = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                        self.typing_effect("How often do you take it? (e.g., daily, twice a day)", Fore.CYAN)
                        frequency = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                        user_input = f"Add medication: identifier {contact_info}, medication {medication}, dosage {dosage}, frequency {frequency}"
                elif option == 11:
                    self.typing_effect("Please provide the doctor ID:", Fore.CYAN)
                    doctor_id = input(Fore.GREEN + "> " + Style.RESET_ALL).strip()
                    user_input = f"Show appointments for doctor with ID {doctor_id}"
                else:
                    self.typing_effect("Invalid option. Please try again.", Fore.RED)
                    continue
                
            # Process the user input using the AI agent
            response = self.process_user_input(user_input)
            
            # Format and display the response
            formatted_response = self.format_markdown(response)
            if isinstance(formatted_response, Markdown):
                console.print(formatted_response)
            else:
                self.typing_effect(response, Fore.WHITE)
                
            # Check if the response indicates to exit (from booking an appointment)
            if response == "exit":
                break
                
            # If this was a symptom check, offer to book with a specialist
            if "Check these symptoms:" in user_input and hasattr(self, 'recommended_specialist'):
                self.rich_panel("Specialist Recommendation", 
                               f"Based on your symptoms, I recommend consulting with a {self.recommended_specialist}.", 
                               style="cyan")
                
                self.typing_effect("Would you like to see a list of doctors specializing in this area? (yes/no)", Fore.YELLOW)
                see_doctors = input(Fore.GREEN + "> " + Style.RESET_ALL).strip().lower()
                
                if see_doctors in ["yes", "y"]:
                    matching_doctors = self.get_specialist_doctors(self.recommended_specialist)
                    
                    # Create a table for doctors
                    doctors_data = [[str(i), doctor] for i, doctor in enumerate(matching_doctors, 1)]
                    self.rich_table("Doctors Specializing in This Area", ["#", "Doctor"], doctors_data)
                    
                    self.typing_effect("\nWould you like to book an appointment with any of these doctors? (yes/no)", Fore.YELLOW)
                    book_appointment = input(Fore.GREEN + "> " + Style.RESET_ALL).strip().lower()
                    
                    if book_appointment in ["yes", "y"]:
                        # Set the recommended doctor in user_data
                        self.user_data = {}
                        self.user_data["doctor"] = matching_doctors[0]  # Default to first doctor
                        
                        # Collect user info and book appointment
                        user_data = self.collect_user_info()
                        self.appointments.append(user_data)
                        self.save_data(self.appointments, self.data_file)
                        self.display_appointment_summary()
                        
                        # Ask if user wants to exit after booking
                        self.typing_effect("\nWould you like to exit the application? (yes/no)", Fore.YELLOW)
                        exit_choice = input(Fore.GREEN + "> " + Style.RESET_ALL).strip().lower()
                        
                        if exit_choice in ["yes", "y"]:
                            self.typing_effect("Thank you for using our AI Healthcare Assistant. Have a healthy day!", Fore.GREEN)
                            break

if __name__ == "__main__":
    bot = HealthcareBot()
    bot.start()