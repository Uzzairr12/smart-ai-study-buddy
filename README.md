# Smart AI Study Buddy

A responsive AI-powered study companion built with HTML, CSS, vanilla JavaScript, Node.js, Express, MongoDB Atlas, and Google Gemini.

## Features

- Student registration and login (bcrypt password hashing + JWT)
- AI study chat with English, Urdu, Roman Urdu, and Sindhi response options
- Mathematics help with step-by-step explanations and image upload
- Urdu and Sindhi learning, translation, vocabulary, and grammar prompts
- AI answer evaluation with constructive feedback
- MCQ quizzes with answer explanations and saved results
- Student progress dashboard
- Responsive interface and light/dark appearance toggle

## Requirements

- Node.js 18+
- MongoDB Atlas database (or local MongoDB)
- Google Gemini API key

## Run locally

1. Extract the project and open its folder in a terminal.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`.
4. Set `MONGODB_URI`, `JWT_SECRET`, and `GEMINI_API_KEY` in `.env`.
5. Start the server:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:5000`.

The frontend and API are served by the same Express app in this setup.

## Configure MongoDB Atlas

1. Create a free MongoDB Atlas cluster.
2. Create a database user and a strong password.
3. Add your deployment host to Atlas Network Access. For a quick hosted demo, `0.0.0.0/0` allows connections from any IP, so use a strong database password and consider tighter network rules where possible.
4. Copy the application's connection string into `MONGODB_URI`.

## Configure Gemini

1. Create an API key in Google AI Studio.
2. Add it to `GEMINI_API_KEY`.
3. Keep this key in server environment variables only. Never put it in frontend JavaScript or commit it to Git.

## Deploy publicly on Render

This project serves both the frontend and backend from one Node.js service, which keeps deployment straightforward.

1. Push this project to a GitHub repository.
2. Create a new Web Service in Render and connect the repository.
3. Set **Build Command** to `npm install`.
4. Set **Start Command** to `npm start`.
5. Add environment variables in Render:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (optional; default is `gemini-2.0-flash`)
   - `CLIENT_ORIGIN` (optional; leave unset for same-origin deployment)
6. Deploy. Render will provide a public `onrender.com` URL.

You can also deploy the same Node.js service on Vercel using its Node runtime, but Render is the simpler option for this Express server. Netlify is best suited to the static frontend and requires a separate backend service.

## Before sharing with students

- Test registration and login.
- Test the AI assistant, math solver, language tool, and answer evaluator.
- Test quiz submission and progress history.
- Check mobile layout.
- Confirm all environment variables are set on the hosting provider.
- Review Gemini API quotas and usage costs.
- Add a privacy policy and terms of use before collecting real student information.

## Current project scope and honest limitations

- The quiz bank contains sample questions and can be expanded in `server.js`.
- Quiz attempts are saved when MongoDB is connected and the user is signed in.
- AI features require a valid Gemini API key and may be subject to provider quotas.
- AI-generated language and academic feedback should be reviewed by students and teachers.
- This repository is deployment-ready source code, but it is not already deployed. A live public URL requires the owner's GitHub, hosting, MongoDB, and Gemini account setup.

## Project structure

```text
smart-ai-study-buddy/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── README.md
```
