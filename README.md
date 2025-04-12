# Backend — MernEats Food Ordering App

This is the backend of the MernEats Food Ordering App, responsible for managing authentication, users, restaurants, orders, and payments. It exposes a RESTful API consumed by the frontend client.

## Tech Stack

    Node.js + Express – Web server & API framework

    MongoDB + Mongoose – NoSQL database & object modeling

    Auth0 – Authentication & user identity

    Stripe – Payment processing & checkout

    Cloudinary – Image storage and delivery

    Multer – File upload handling

    express-validator – Input validation

    dotenv – Environment variable management

    TypeScript – Type safety

Create a `.env` file in the backend/ folder with the following variables:

    PORT=7000
    MONGODB_CONNECTION_STRING=your_mongodb_connection_string
    AUTH0_AUDIENCE=your_auth0_api_audience
    AUTH0_ISSUER_BASE_URL=https://your-auth0-domain/
    CLOUDINARY_CLOUD_NAME=your_cloudinary_name
    CLOUDINARY_API_KEY=your_cloudinary_api_key
    CLOUDINARY_API_SECRET=your_cloudinary_api_secret
    FRONTEND_URL=http://localhost:5173
    STRIPE_SECRET_KEY=your_stripe_secret_key
    STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

    🔐 Keep this file secret and do not commit it to version control.

## Getting Started:

    Navigate into the backend folder:

`cd backend`

    Install dependencies:

`npm install`

    Run the server:

`npm run dev`

    The server will start at http://localhost:7000
