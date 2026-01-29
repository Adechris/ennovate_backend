# CredPal Backend Assessment (Wallet API)

This project is a robust **Wallet & Transaction API** built for the CredPal Backend Developer assessment. While the primary focus is the backend, I have also included a **Frontend Demo** to provide a visual way to interact with and verify the API's functionality.

> [!NOTE]
> The **Backend** is the core of this assessment. The frontend is provided as a supplementary tool to demonstrate the API in a real-world scenario.

## Tech Stack

### Backend
- **Node.js & Express**: Server framework.
- **TypeScript**: For type safety and better developer experience.
- **MongoDB & Mongoose**: Database and ODM.
- **JWT & Bcryptjs**: Authentication and password hashing.

### Frontend (Supplementary Demo)
- **Vite & React**: Fast build tool and UI library.
- **Tailwind CSS v3**: Utility-first CSS framework for styling.
- **Axios**: For API requests.

## Features

- **User Authentication**: Register, Login, Update Profile (on Dashboard), and Delete Account.
- **Wallet System**: Automatic wallet creation upon registration with balance tracking.
- **Transaction Management**: Create deposits and withdrawals (updates balance automatically).
- **Transparency**: Transactions are immutable (cannot be updated or deleted).
- **Protected Routes**: Secure endpoints using JWT middleware.

## Getting Started

### Prerequisites
- Node.js (v16+)
- MongoDB (Running locally or Atlas URI)

### Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/credpal_wallet
   JWT_SECRET=5a3e7b1c-4f8d-4e9a-9c8b-7d6e5f4a3b2c
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Navigate to the `frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Auth
- `POST /api/auth/register`: Register a new user.
- `POST /api/auth/login`: Login and receive JWT.
- `GET /api/auth/me`: Get current user details (Protected).
- `PUT /api/auth/profile`: Update user profile (Protected).
- `DELETE /api/auth/account`: Delete user account (Protected).

### Wallet
- `GET /api/wallet`: Get current wallet balance (Protected).

### Transactions
- `GET /api/transactions`: List all user transactions (Protected).
- `POST /api/transactions`: Create a new transaction (Protected).
  - Body: `{ "amount": number, "type": "deposit" | "withdrawal", "description": string }`

## Postman Documentation
You can import the `backend/Postman_Collection.json` (if provided) or manually set up the endpoints using the list above. Ensure you include the `Authorization: Bearer <token>` header for protected routes.
