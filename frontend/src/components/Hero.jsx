import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { FaPlay, FaUserGraduate, FaChartLine, FaShieldAlt } from 'react-icons/fa';
import { LanguageContext } from '../context/LanguageContext';

const Hero = () => {
  const { strings } = useContext(LanguageContext);
  const isAuthenticated = false;
  const isOpen = true;

  const getButton = () => {
    if (!isAuthenticated) {
      return (
        <Link to="/login" className="btn-primary inline-flex items-center gap-2">
          <FaPlay /> {strings.login} to Evaluate
        </Link>
      );
    }
    if (isOpen) {
      return (
        <Link to="/student-dashboard" className="btn-primary inline-flex items-center gap-2">
          <FaPlay /> Start Evaluation
        </Link>
      );
    }
    return (
      <button className="btn-primary-disabled inline-flex items-center gap-2" disabled>
        <FaPlay /> Evaluation Closed
      </button>
    );
  };

  return (
    <section className="py-8 md:py-16">
      <div className="container-custom">
        <div className="mt-8 md:mt-12 text-center">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-ieps-blue-600 leading-tight">
            {strings.welcome} to the <br className="hidden sm:block" />
            <span className="text-ieps-blue-400">Instructor Performance</span>
            <br className="hidden md:block" />
            <span className="text-ieps-blue-700">Evaluation System</span>
          </h1>
          
          <p className="mt-4 md:mt-6 text-base md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            {strings.description}
          </p>

          <div className="mt-6 md:mt-8">
            {getButton()}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <FaUserGraduate className="text-ieps-blue-500" />
              Secure & Anonymous
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              <FaChartLine className="text-ieps-blue-500" />
              Real-time Reports
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              <FaShieldAlt className="text-ieps-blue-500" />
              Continuous Improvement
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;