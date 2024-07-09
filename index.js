const express = require('express');
const { mongoConnect } = require('./services/mongo');
const cors = require("cors");
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const activityRoutes = require('./routes/activity');
const tagRoutes = require('./routes/tag');
const emailRoutes = require('./routes/email');
const imageRoutes = require('./routes/image');
const session = require("express-session");
const passport = require("passport");
require("./services/passport");
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(
    cors({
      origin: [
        process.env.FRONTEND_URL,
        'https://daodao-f2e-daodaoedu.vercel.app',
        'https://daodao-f2e-pi.vercel.app',
        'http://localhost:5000',
        'https://dev.daodao-notion-test.pages.dev',
        'https://www.daoedu.tw',
    ],
      methods: "GET,POST,PUT,DELETE",
      credentials: true,
    })
  );

app.use(session({
    secret: process.env.SESSION_SEVRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true },
}))
app.use(passport.initialize());
app.use(passport.session());
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/activity', activityRoutes);
app.use('/tag', tagRoutes);
app.use('/email', emailRoutes);
app.use('/image', imageRoutes);

// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

app.get('/', (req, res) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${process.env.NODE_ENV} Environment</title>
    </head>
    <body>
      <h1>Current Environment: ${process.env.NODE_ENV}</h1>
      <p>PORT: ${process.env.PORT}</p>
      <p>FRONTEND_URL: ${process.env.FRONTEND_URL}</p>
      <p>MONGODB_URL: ${process.env.MONGODB_URL}</p>
      <p>REDIS_HOST: ${process.env.REDIS_HOST}</p>
    </body>
    </html>
  `;
  res.send(htmlContent);
});

const redirectUrl = process.env.NODE_ENV === 'production' ? 'https://daodaoedu.tw' : 'https://dev.daodao-notion-test.pages.dev';
console.log(redirectUrl);

async function startServer() {
    await mongoConnect();
    app.listen(PORT, () => {
        console.log(`Listening on port ${PORT}...`)
    });
}

startServer();
