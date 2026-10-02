@echo off
set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\Admin\Downloads\streaming-web-2272d-firebase-adminsdk-fbsvc-77beab3bb0.json
set FIREBASE_PROJECT_ID=streaming-web-2272d
cd /d "%~dp0"
call .venv\Scripts\activate
python process_jobs.py --once
python process_reports.py
