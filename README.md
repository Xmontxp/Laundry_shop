
# Laundry shop - Starter React Project

This is a minimal React starter project (Vite) with two components:
- `MachineList` (src/components/MachineList.jsx)
- `TopUpForm` (src/components/TopUpForm.jsx)

The project is intentionally simple so you can edit the pages and components.
Files:
- package.json
- index.html
- src/main.jsx
- src/App.jsx
- src/styles.css
- src/components/MachineList.jsx
- src/components/TopUpForm.jsx

## How to run

1. Install dependencies
   ```bash
   npm install
   ```
2. Start development server
   ```bash
   npm run dev
   ```

Note: This project uses Vite. If you don't have Vite installed globally, the dev dependency in package.json will be used.



## Backend (Node.js/Express)

A simple backend is included in `/backend` that simulates machines and countdown timers.
How to run backend:

```bash
cd backend
npm install
npm start
```

Environment file: copy `.env.example` to `.env` and set `WEBHOOK_URL` if you want notifications to be POSTed.


## Backend
This project now includes a Node.js + Express backend in the `backend/` folder.

### How to run backend
```bash
cd backend
npm install
npm run dev
```
This will start the backend on port 3001.
