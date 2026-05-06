#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Melhorias no calendário e editor de horários:
  1. Ao tocar num dia no calendário, mostrar apenas o horário do utilizador e um
     botão "+" no canto inferior direito para trocar/mudar o horário desse dia.
  2. As cores associadas às horas de entrada devem atualizar automaticamente ao
     alterar a hora de entrada; o editor de horários deve ter um botão "Guardar"
     que guarda e altera os dados do horário e as cores.

frontend:
  - task: "Generic employee parser (any workplace, any ID format)"
    implemented: true
    working: true
    file: "frontend/src/lib/pdfParser.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Replaced strict regex /^(5\\d{7})\\s*[-–]\\s*(.+)$/ with three patterns: ID-first with dash, name-first with ID at end, applied only to the LEFT block (left of the first day column) so codes don't break the $ anchor. Accepts any 4-10 digit ID. Verified end-to-end with 6 different formats: SATA 5xxxxxxx, OAE 6xxxxxxx, short 12345, reverse 'Name 67890123', 4xxxxxxx, multi-word reverse — all 6 detected with correct names and IDs. App now works with any work-schedule PDF, not just SATA."

  - task: "Frontend-only PDF parser (offline / no backend)"
    implemented: true
    working: true
    file: "frontend/src/lib/pdfParser.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Ported backend pdfplumber-based parser to JavaScript using pdfjs-dist@4.8.69. Replicates the exact algorithm: word grouping into lines by y position, day-header detection (>=10 ints 1..31 mostly increasing), employee row regex /^(5\\d{7})\\s*[-–]\\s*(.+)$/, code-to-day assignment by nearest x center, month/year detection from filename + text. App.js no longer imports axios or REACT_APP_BACKEND_URL; handleFile calls parseSchedulePdf locally. Verified end-to-end with a synthetic jsPDF-generated schedule: 2 employees + 7 distinct codes parsed correctly, calendar rendered with correct colors, Quem és tu? modal appeared, no console errors. App is now fully self-contained on the frontend and can be deployed to Vercel/Netlify static hosting for free."

  - task: "Default codes updated to user-provided list (17 codes)"
    implemented: true
    working: true
    file: "frontend/src/lib/codes.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Replaced DEFAULT_CODES with the exact 17 codes provided by user (M7, M13, M14, M37, M42, M50, 50A, M76, IT2, T6, 720, 796, D, DF, 704, F, 791) with correct entry/lunch/exit times and labels. Bumped storage key v3->v4 to force-reload defaults for existing users. D code kept as folga (no entry/exit) — the 12:00-23:59 range from the PDF legend is descriptive only."

  - task: "Day detail modal on calendar cell tap with floating + swap button"
    implemented: true
    working: true
    file: "frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Added DayDetailModal that shows only the current user's shift (code, label, entry/exit, lunch) when a calendar cell is tapped. A floating + button in the bottom-right opens the existing CellEditModal to swap the code. Verified via Playwright that tapping day-cell-5 opens the detail modal and the + triggers the code picker."

  - task: "CodesDrawer: auto-infer kind from entry + Save/Discard button"
    implemented: true
    working: true
    file: "frontend/src/components/CodesDrawer.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Codes drawer now keeps a local draft. Editing entry auto-updates kind (manha ≤08:30, intermedio 08:31-09:30, tarde ≥09:31) while preserving folga/ferias. Save commits to parent state (which persists via existing useEffect). Discard reverts. Closing with unsaved changes prompts confirmation. Code-pill background in each row reflects the current (draft) entry time for live color preview. Playwright verified: entry 07:30→10:00 on M7 flips kind to tarde, save enables/disables correctly, and the calendar M7 cells turn red after save."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Implemented both user requests. Verified manually via Playwright with seeded localStorage (schedule + me). No backend changes. Waiting for user to approve / request further tweaks."