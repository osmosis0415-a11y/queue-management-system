# Queue Management System

A real-time queue management system with:
- live admin dashboard
- public display board
- automatic queue updates using Socket.IO
- service counters and ticket management

## Local run

```bash
npm install
npm start
```

Then open:
- Admin dashboard: http://localhost:3000/
- Public display: http://localhost:3000/display.html

## Deploy to Render

1. Push this repository to GitHub.
2. In Render, select New > Web Service.
3. Connect this repository.
4. Use the default settings or the included `render.yaml` file.
5. Deploy the service.

## Live URL

Once deployed, Render will provide a public URL such as:
`https://queue-management-system.onrender.com`

## Stack

- Node.js
- Express
- Socket.IO
