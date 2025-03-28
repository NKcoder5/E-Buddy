import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="logo">
        <img src="/logo.png" alt="E-Buddy Logo" />
      </div>

      <ul className="nav-links">
        <li><Link to="/LearningPath">Learning Path</Link></li>
        <li><Link to="/career-path">Career Guidance</Link></li>
        <li><Link to="/signup">Signup</Link></li>
        <li><Link to="/login">Login</Link></li>
      </ul>
    </nav>
  );
};

export default Navbar;
