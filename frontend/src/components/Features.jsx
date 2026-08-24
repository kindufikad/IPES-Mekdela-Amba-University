import React from 'react';
import { FaStar, FaChartLine, FaUserShield, FaMobileAlt, FaClock, FaFileAlt } from 'react-icons/fa';

const Features = () => {
  const features = [
    {
      icon: FaStar,
      title: 'Evaluate Instructors',
      description: 'Provide constructive feedback on teaching performance, methodology, and engagement.',
      color: 'text-yellow-500',
      bg: 'bg-yellow-50'
    },
    {
      icon: FaChartLine,
      title: 'Performance Analytics',
      description: 'View aggregated reports and insights to identify teaching excellence and areas for growth.',
      color: 'text-blue-500',
      bg: 'bg-blue-50'
    },
    {
      icon: FaUserShield,
      title: 'Secure & Anonymous',
      description: 'Your identity is protected. Honest feedback helps improve the quality of education.',
      color: 'text-green-500',
      bg: 'bg-green-50'
    },
    {
      icon: FaMobileAlt,
      title: 'Mobile Friendly',
      description: 'Access the system from any device - desktop, tablet, or smartphone.',
      color: 'text-purple-500',
      bg: 'bg-purple-50'
    },
    {
      icon: FaClock,
      title: 'Real-time Updates',
      description: 'Instant submission and tracking of evaluation status and response rates.',
      color: 'text-red-500',
      bg: 'bg-red-50'
    },
    {
      icon: FaFileAlt,
      title: 'Comprehensive Reports',
      description: 'Generate detailed reports for administrators, departments, and faculty development.',
      color: 'text-indigo-500',
      bg: 'bg-indigo-50'
    }
  ];

  return (
    <section className="py-12 md:py-20 bg-white">
      <div className="container-custom">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-2xl md:text-4xl font-bold text-ieps-blue-600">
            Why Use <span className="text-ieps-blue-400">IEPS?</span>
          </h2>
          <p className="mt-2 text-gray-500 max-w-2xl mx-auto">
            A modern solution designed to enhance teaching quality through student feedback
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index}
                className="card group hover:scale-[1.02] transition-transform duration-300"
              >
                <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`text-2xl ${feature.color}`} />
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-500 text-sm md:text-base leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;