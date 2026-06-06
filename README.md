# Real-Time Chat Application (VibeChat)

A full-stack real-time chat application built with the MERN stack (MongoDB, Express, React, Node.js) and Socket.IO.

## Features
- **User Management**: JWT-based authentication, Registration, and Login.
- **Real-Time One-to-One Chat**: Instant messaging with online/last seen status.
- **Group Chat**: Create groups, add members, and chat in real-time.
- **Typing Indicators**: See when someone is typing a message to you or in a group.
- **Premium UI**: Built with Tailwind CSS for a modern, responsive, dark-mode design.

## Prerequisites
- Node.js (v16+)
- MongoDB (Local or Atlas)

## Setup & Running Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/praman07/Socketio.git
   cd Socketio
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```
   Create a `.env` file in the `backend` directory (if not present) with:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/chatapp
   JWT_SECRET=supersecretjwtkey123
   ```
   Start the backend server:
   ```bash
   npm run start
   # or with nodemon
   npx nodemon server.js
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```
   Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:5173`.

## Live Deployment Instructions
To make this application "live", follow these steps:
1. **Database**: Create a free MongoDB Atlas cluster and replace `MONGODB_URI` in your backend `.env` (or hosting platform's environment variables).
2. **Backend**: Deploy the `backend` folder to a service like [Render](https://render.com) or [Heroku](https://heroku.com).
3. **Frontend**: Deploy the `frontend` folder to [Vercel](https://vercel.com) or [Netlify](https://netlify.com). Ensure you change the hardcoded `http://localhost:5000` URLs in the React components to your new live backend URL.
