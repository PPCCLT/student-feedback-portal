# Student Feedback Portal - Department-Based Admin System

A comprehensive student feedback portal with department-specific admin access control.

## 🏢 **Department-Based Admin System**

### **Admin Access Levels:**

1. **🔧 Super Admin** - Full access to all feedback across all categories
2. **🏢 Facilities Admin** - Manages facilities-related feedback only
3. **📚 Academic Admin** - Manages lectures and academic feedback only  
4. **🏫 Infrastructure Admin** - Manages classroom and infrastructure feedback only
5. **🎉 Events Admin** - Manages events and activities feedback only
6. **📋 General Admin** - Manages general and miscellaneous feedback only

### **Department Responsibilities:**

#### 🏢 **Facilities Department**
- Wi-Fi & Internet Access
- Library Resources  
- Laboratory Equipment & Maintenance
- Computer Labs
- Hostel / Accommodation
- Sports Facilities
- Cleanliness & Hygiene

#### 📚 **Academic Department**
- Teaching Clarity
- Course Content Quality
- Evaluation & Assessment
- Pace of Teaching
- Use of Teaching Aids / Technology

#### 🏫 **Infrastructure Department**
- Seating and Comfort
- Lighting and Ventilation
- Audio-Visual Equipment
- Classroom Availability / Scheduling Issues

#### 🎉 **Events Department**
- Event Organization & Coordination
- Timing / Scheduling
- Relevance to Academics
- Participation & Opportunities
- Communication / Information Dissemination

#### 📋 **General Administration**
- General Feedback
- Suggestions
- Complaints
- Compliments
- Miscellaneous

## 🚀 **How to Access:**

### **For Students:**
1. Go to `http://localhost:3000/index.html`
2. Click "Get Started" to submit feedback
3. Select category → subcategory → fill form → submit

### **For Admins:**
1. Go to `http://localhost:3000/admin_login.html`
2. Select your department
3. Enter department password
4. Access your department-specific dashboard

## 🔐 **Admin Login Credentials:**

| Department | Password |
|------------|----------|
| Super Admin | `superadmin123` |
| Facilities | `facilities123` |
| Academic | `academic123` |
| Infrastructure | `infrastructure123` |
| Events | `events123` |
| General | `general123` |

## 📱 **Available Pages:**

### **Student Pages:**
- `index.html` - Home page
- `feedback.html` - Feedback submission form

### **Admin Pages:**
- `admin_login.html` - Department selection and login
- `admin_dashboard.html` - Super admin (all feedback)
- `admin_facilities.html` - Facilities admin dashboard
- `admin_lectures.html` - Academic admin dashboard
- `admin_classrooms.html` - Infrastructure admin dashboard
- `admin_events.html` - Events admin dashboard
- `admin_general.html` - General admin dashboard

## ✨ **Key Features:**

### **Student Features:**
- ✅ Dynamic subcategory selection based on category
- ✅ Optional suggestions field
- ✅ Form validation and submission
- ✅ Anonymous feedback submission
- ✅ Offline support with localStorage

### **Admin Features:**
- ✅ Department-specific access control
- ✅ Category-filtered feedback views
- ✅ Subcategory and urgency filtering
- ✅ Mark feedback as resolved
- ✅ Delete feedback
- ✅ Statistics overview
- ✅ Session management with logout
- ✅ Switch between departments

### **Security Features:**
- ✅ Password-based authentication
- ✅ Session management
- ✅ Department access control
- ✅ Automatic logout after 24 hours

## 🛠️ **Technical Stack:**
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js with Express
- **Database**: JSON file storage
- **Authentication**: Session-based with localStorage

## 🚀 **Getting Started:**

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   node server.js
   ```

3. **Access the application:**
   - Students: `http://localhost:3000`
   - Admins: `http://localhost:3000/admin_login.html`

## 🛠️ Developer Notes

### Environment Variables

- `PORT`: Server port (default: `3000`)
- `CORS_ORIGIN`: Comma-separated allowed origins for CORS, e.g. `https://example.com,https://admin.example.com`
- `JSON_BODY_LIMIT`: Max JSON size for requests (default: `100kb`)
- `MAX_TEXT_LEN`: Max length for feedback `text` (default: `4000`)
- `MAX_SUGGESTIONS_LEN`: Max length for `suggestions` (default: `2000`)
- `MONGODB_URI`: Mongo connection string (default: `mongodb://127.0.0.1:27017`)
- `MONGODB_DB`: Database name (default: `student_feedback_portal`)
- `MONGODB_COLLECTION`: Collection name (default: `feedbacks`)

### Admin Authentication (Server-Side)

New endpoints:

- `POST /api/login` – body: `{ "department": "Facilities", "password": "..." }`
  - Returns `{ ok: true, token, department }` and also sets an HTTP-only cookie `admin_session`.
- `POST /api/logout` – clears the session cookie.

Use the token via `Authorization: Bearer <token>` or rely on the cookie from browsers. Admin-only endpoints now require authentication:

- `PATCH /api/feedbacks/:id/status`
- `PATCH /api/feedbacks/:id/resolve`
- `DELETE /api/feedbacks/:id`

Configure admin credentials and JWT secret with env vars:

- `ADMIN_PASSWORDS_JSON` – JSON map of department to password. Example:
  ```json
  {"Super Admin":"superadmin123","Facilities":"facilities123","Academic":"academic123","Infrastructure":"infrastructure123","Events":"events123","General":"general123"}
  ```
- or individual envs: `ADMIN_PASSWORD_SUPER`, `ADMIN_PASSWORD_FACILITIES`, `ADMIN_PASSWORD_ACADEMIC`, `ADMIN_PASSWORD_INFRASTRUCTURE`, `ADMIN_PASSWORD_EVENTS`, `ADMIN_PASSWORD_GENERAL`
- `ADMIN_JWT_SECRET` – secret for signing admin JWTs
- `SESSION_COOKIE_NAME` – cookie name (default: `admin_session`)
- `SESSION_TTL_SECONDS` – token/cookie lifetime (default: 86400)

If using cookies from the browser, set:

- `CORS_ORIGIN` to your site origin and ensure it’s accurate
- Cookies are `SameSite=Lax` by default and `Secure` in production

Example (PowerShell):

```powershell
$env:CORS_ORIGIN = "http://localhost:3000"
$env:ADMIN_JWT_SECRET = "replace-me"
$env:ADMIN_PASSWORDS_JSON = '{"Super Admin":"superadmin123","Facilities":"facilities123","Academic":"academic123","Infrastructure":"infrastructure123","Events":"events123","General":"general123"}'
npm run dev
```

### MongoDB (Optional)

When MongoDB is reachable via `MONGODB_URI`, the server uses it for storage with indexes on `id` and `createdAt`. If MongoDB is not available, it falls back to JSON file storage at `data/feedbacks.json` with a minimal write queue to reduce write conflicts under load.

### API Pagination & Filters

`GET /api/feedbacks` now supports:

- `limit` (default 50, max 200)
- `page` (default 1)
- `status` (e.g., `pending|in-progress|resolved`)
- `category` (e.g., `General`, `Facilities`)
- `search` (case-insensitive search across `text` and `suggestions`)

Response shape:

```json
{
  "data": [ /* feedbacks */ ],
  "pagination": { "total": 123, "page": 1, "limit": 50, "pages": 3 }
}
```

### API Smoke Test

Run a simple smoke test (requires server running):

```bash
npm run test:api
# optionally set BASE_URL if not localhost:3000
# BASE_URL=http://localhost:4000 npm run test:api
```

### Security & Next Steps

- CORS is restricted via `CORS_ORIGIN` when set.
- Basic input sanitization and size limits are enforced on create.
- Recommended next step: Move admin credentials and auth checks to the server (e.g., add `/api/login` issuing tokens/cookies and guard admin-only endpoints). Frontend dashboards would call the login endpoint and include credentials on subsequent requests.

## 📊 **Benefits:**

- **Organized Management**: Each department handles only relevant feedback
- **Improved Efficiency**: Faster response times for specific issues
- **Clear Accountability**: Direct responsibility assignment
- **Better Organization**: Structured feedback categorization
- **Enhanced Security**: Department-specific access control
- **Scalable System**: Easy to add new departments or categories

## 🔄 **Workflow:**

1. **Student submits feedback** → Categorized by department
2. **Department admin logs in** → Sees only their relevant feedback
3. **Admin reviews and resolves** → Updates feedback status
4. **Super admin monitors** → Overall system oversight

This system ensures that each piece of feedback reaches the right department for quick and efficient resolution! 🎯