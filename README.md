# Online Doctor Appointment and Clinic Token Scheduling System

A full-stack clinic scheduling MVP built with React, Django REST Framework, SQLite, and plain CSS. Patients can browse doctors, reserve available time slots, receive appointment tokens, and manage appointments using a private access code. Clinic staff can manage departments, doctors, schedules, and appointment statuses.

## Requirements

- Python 3.11 or newer
- Node.js 20.19+ or 22.12+
- npm

## Setup on Windows PowerShell

Open two PowerShell terminals from the project root.

### 1. Configure and start the backend

```powershell
cd .\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r ..\requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py createsuperuser
python manage.py check
python manage.py test
python manage.py runserver
```

The seed command creates sample departments and doctors only; it does not create fake patient appointments or a default admin account. Use the username and password you choose in `createsuperuser` on the staff login page.

When Django management commands run locally without explicit environment settings, the project automatically creates and reuses a secret key in `backend/.django_secret_key` (excluded from source control) and enables development mode. You can now start the backend with just `python manage.py runserver`. In local development, email messages use Django's console backend and are printed to the backend terminal; no real email is sent. For production, explicitly configure a private `DJANGO_SECRET_KEY` and `DJANGO_DEBUG=false`; never use development mode or the development CORS origins in production.

### 2. Install and start the frontend

```powershell
cd .\frontend
npm ci
npm test
npm run lint
npm run build
npm run dev
```

Open the Vite URL printed by the command, usually `http://localhost:5173`. The frontend calls `http://localhost:8000/api` by default. Set `VITE_API_BASE_URL` in a local `frontend/.env` file to use a different backend URL; do not put secrets in frontend environment variables.

### Database and sample data

- SQLite data is stored in `backend/db.sqlite3`.
- `python manage.py migrate` creates or updates the database schema.
- `python manage.py seed_data` can be safely rerun; it adds the sample departments/doctors if they do not already exist.
- The seed command deliberately does not generate appointments. Use the patient booking page to create real test appointments.
- For a fresh administrator account, run `python manage.py createsuperuser`.

## Patient privacy and booking

The server validates the doctor schedule and slot before booking. Appointment creation is transactional, with database uniqueness constraints for active doctor/time slots and doctor/date/token combinations. Cancelled token numbers are not reused.

On booking, the API returns a randomly generated appointment access code once. The database stores only its SHA-256 hash. Keep the code private: the patient must provide it together with the registered email or phone number to retrieve or cancel that appointment. It is not included in appointment detail responses or URLs. When SMTP is configured, a confirmation containing the code is sent to the email address supplied during booking. If sending fails, booking remains confirmed and the response includes `email_sent: false`; the confirmation page still displays the access code.

The five older demo appointments have no access code and were intentionally preserved. A staff member can issue a one-time code from the appointment management page; it is emailed to the address on file. If delivery fails, the code is shown once to staff to share through another verified channel. Verify the patient's identity before sharing it.

### Configure confirmation email

`.env.example` documents the required variable names but is not automatically loaded by Django. Set them in the backend process/environment (or use a protected environment manager) and configure `DJANGO_EMAIL_BACKEND`, `DJANGO_EMAIL_HOST`, `DJANGO_EMAIL_PORT`, `DJANGO_EMAIL_HOST_USER`, `DJANGO_EMAIL_HOST_PASSWORD`, `DJANGO_EMAIL_USE_TLS` or `DJANGO_EMAIL_USE_SSL`, and `DJANGO_DEFAULT_FROM_EMAIL` using credentials from your SMTP provider. Do not commit real credentials. Restart Django after changing mail settings. In local development, leave the email backend unset to print test messages in the terminal.

## API overview

Public endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/` | API index with links to commonly used endpoints |
| GET | `/api/departments/` | List departments |
| GET | `/api/doctors/` | List active doctors; accepts department, specialization, and search filters |
| GET | `/api/doctors/{id}/` | Retrieve a doctor |
| GET | `/api/slots/?doctor_id={id}&date={YYYY-MM-DD}` | Get future bookable slots |
| POST | `/api/appointments/` | Book an appointment; returns a one-time `access_token` |
| GET | `/api/appointments/lookup/?email={email}` | Look up an appointment with `X-Appointment-Access-Token` header |
| GET | `/api/appointments/{id}/` | Retrieve appointment details with the access-code header |
| POST | `/api/appointments/{id}/cancel/` | Cancel an eligible appointment with the access-code header |
| POST | `/api/auth/login/` | Authenticate staff and return a DRF token |
| POST | `/api/auth/logout/` | Revoke the current staff token |
| GET | `/api/auth/me/` | Get the authenticated staff user |

Staff endpoints require `Authorization: Token <token>` and a Django staff account:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/admin/dashboard/` | Dashboard totals and today's schedule |
| GET | `/api/admin/appointments/` | Search and filter appointments |
| PATCH | `/api/admin/appointments/{id}/status/` | Update appointment status |
| POST | `/api/admin/appointments/{id}/access-code/` | Issue or rotate a patient access code and email it |
| GET, POST | `/api/admin/doctors/` | List or create doctors |
| GET, PUT, PATCH, DELETE | `/api/admin/doctors/{id}/` | Retrieve, update, or delete a doctor |
| GET, POST | `/api/admin/departments/` | List or create departments |
| GET, PUT, PATCH, DELETE | `/api/admin/departments/{id}/` | Retrieve, update, or delete a department |

Appointment lookup and patient actions require the `X-Appointment-Access-Token` request header. A wrong or missing code cannot retrieve appointment details or cancel the appointment. Department deletion returns `409 Conflict` while the department still has doctors. The staff-only access-code endpoint returns the generated code only once; pass `{"rotate": true}` to invalidate an old code and email a replacement.

## Deployment hardening checklist

This repository does not deploy itself and no hosting or mail-provider credentials were supplied. Before exposing it to the internet:

1. Set a unique `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, and `DJANGO_ALLOWED_HOSTS` to only your backend hostnames.
2. Set `CORS_ALLOWED_ORIGINS` and `DJANGO_CSRF_TRUSTED_ORIGINS` to only the exact HTTPS frontend origins you control.
3. Configure SMTP variables above and `DJANGO_DEFAULT_FROM_EMAIL`; verify delivery with a real mailbox.
4. Terminate HTTPS at a trusted proxy and set `DJANGO_SECURE_SSL_REDIRECT=true`, `DJANGO_SECURE_COOKIES=true`, and `DJANGO_SECURE_HSTS_SECONDS` (start HSTS conservatively until HTTPS is confirmed). Set `DJANGO_TRUST_X_FORWARDED_PROTO=true` only when the trusted reverse proxy overwrites that header.
5. Configure actual environment variables; `.env.example` is documentation only and is not loaded at runtime. Run `python manage.py check --deploy` with the production environment, review every warning, back up the database, and test restore procedures.
6. Restrict access to the database and logs; never log appointment access codes, SMTP credentials, or patient symptoms.

SQLite is kept to match the project specification. It is suitable for a local/low-traffic single-instance demonstration but is not a robust production database for a public clinic with concurrent bookings; a real deployment should migrate to a server database and load-test it before handling real patient data. This project is not certified for clinical use.

## Tests and verification

Backend:

```powershell
cd .\backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Frontend:

```powershell
cd .\frontend
npm test
npm run lint
npm run build
```

Backend tests cover slot generation, booking, token allocation, double-booking rejection, invalid schedule days/times, privacy access codes, cancellations, staff permissions, and confirmation email behavior. Frontend API tests verify conflict error handling and ensure access codes are sent in a header rather than a URL.

## Project flow

1. React fetches departments, active doctors, and the doctor's schedule from Django.
2. When the patient chooses a date, Django generates valid slots using doctor hours, available days, existing bookings, and the current time.
3. On submit, Django validates the patient input and schedule again, checks the slot inside a database transaction, allocates the next daily token, and saves the appointment.
4. The server returns the appointment and a one-time private access code. React shows the confirmation slip and keeps the code in the current browser session for convenient revisit.
5. Patients use their registered email or phone plus the access code to view or cancel their appointment.
6. Staff sign in using Django authentication. Admin APIs check staff permissions before allowing dashboard, doctor, department, or appointment management.

This project is intended for local demonstration and learning, not deployment with real patient data. Production use requires HTTPS, a production-grade database and deployment configuration, proper monitoring/backups, and a verified patient identity/contact delivery process for access-code recovery.
