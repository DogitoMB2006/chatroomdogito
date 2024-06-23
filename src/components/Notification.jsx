import React from 'react';
import './notification.css';

const Notification = ({ notification, onRemove, onClick }) => {
  return (
    <div className="notification" onClick={onClick}>
      <p>{notification.message}</p>
      <button onClick={(e) => {
        e.stopPropagation(); // Evita que el clic en el botón cierre la notificación
        onRemove();
      }}>X</button>
    </div>
  );
};

export default Notification;
