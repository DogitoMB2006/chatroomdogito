// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from './pages/login/login';
import Register from './pages/register/register';
import Home from './pages/app/home';
import Chat from './pages/chat/chat';
import EditProfile from './pages/profile/editprofile'; 

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Home />} />
        <Route path="/chat/:friendUid" element={<Chat />} /> {/* Ruta dinámica para el chat soy gay */}
        <Route path="/profile/edit" element={<EditProfile />} /> {/* Ruta para editar el perfil que no se me olvide */}
      </Routes>
    </Router>
  );
}

export default App;
