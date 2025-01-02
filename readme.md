# Node.js Project Template

This is a Node.js project template that includes user authentication, protected routes, and MongoDB integration using Mongoose.

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- MongoDB Atlas account (or a local MongoDB instance)

## Getting Started

### 1. Clone the repository

```sh
https://github.com/Marlz74/template_node.js-html-css-js

```

### 2. Install dependencies

npm install

### 3. Set up environment variables

ACCESS_TOKEN_SECRET=your_access_token_secret
MONGO_CONNECTION_STRING=your_mongo_db_connection_string

Replace your_access_token_secret with a secret key for JWT token generation, and update the MongoDB connection string with your MongoDB Atlas credentials and database name.

### 4. Start the MongoDB server

If you are using a local MongoDB instance, make sure it is running. If you are using MongoDB Atlas, ensure your cluster is active and accessible.

### 5. Run the application

npm run dev

### Project Structure

project-root/
├── public/
│   ├── css/
│   │   └── style.css
│   └── index.html
├── routes/
│   ├── usersRoute.js
│   └── authRoute.js
├── controllers/
│   └── usersController.js
├── models/
│   └── User.js
├── middleware/
│   └── authMiddleware.js
├── .env
├── app.js
├── db.js
├── server.js
└── [package.json]




### License

This project is licensed under the MIT License.


This `README.md` file provides a comprehensive guide on how to set up and use your Node.js project template. It includes instructions for installing dependencies, setting up environment variables, running the application, and using / creating custom API endpoints.