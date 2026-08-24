import React from 'react';

const About = () => {
  return (
    <div className="container-custom py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-ieps-blue-600 mb-6">About IEPS</h1>
        <div className="prose prose-lg text-gray-600 space-y-4">
          <p>
            The <strong>Instructor Performance Evaluation System (IEPS)</strong> is a comprehensive 
            web-based platform designed for Mekdela Amba University to streamline the process of 
            gathering student feedback on teaching performance.
          </p>
          <h2 className="text-2xl font-semibold text-ieps-blue-600 mt-8">Our Mission</h2>
          <p>
            To foster a culture of continuous improvement in teaching by providing a transparent, 
            efficient, and accessible platform for student evaluations.
          </p>
          <h2 className="text-2xl font-semibold text-ieps-blue-600 mt-8">Key Objectives</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Replace manual paper-based evaluation with a digital solution</li>
            <li>Increase student participation in the evaluation process</li>
            <li>Provide real-time analytics and reports for administrators</li>
            <li>Support faculty development through actionable feedback</li>
            <li>Enhance the overall quality of education at Mekdela Amba University</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default About;