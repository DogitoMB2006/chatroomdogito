import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './pages/login/login';
import Register from './pages/register/register';
import Home from './pages/app/home';
import Chat from './pages/chat/chat';
import EditProfile from './pages/profile/editprofile';
import ChatGroup from './pages/chat/chatgroup';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Home />} />
        <Route path="/chat/:friendUid" element={<Chat />} />
        <Route path="/group/:groupId" element={<ChatGroup />} />
        <Route path="/profile/edit" element={<EditProfile />} />
      </Routes>
      <ToastContainer />
    </Router>
  );
}

export default App;
