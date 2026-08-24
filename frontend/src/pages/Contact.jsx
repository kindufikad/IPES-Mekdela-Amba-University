import React, { useState } from 'react';
import { FaEnvelope, FaPhone, FaMapMarkerAlt, FaClock, FaPaperPlane } from 'react-icons/fa';
import toast from 'react-hot-toast';

const Contact = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    toast.success('Message sent successfully!');
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', message: '' });
    }, 3000);
  };

  return (
    <div className="container-custom py-16">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-ieps-blue-600 text-center mb-4">Contact Us</h1>
        <p className="text-center text-gray-500 mb-12">We'd love to hear from you. Reach out with any questions or feedback.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="col-span-1 space-y-4">
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-ieps-blue-100 text-ieps-blue-600 flex items-center justify-center">
                  <FaEnvelope />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-700">ieps@mekdela.edu.et</p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <FaPhone />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium text-gray-700">+251 XXX XXX XXX</p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                  <FaMapMarkerAlt />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium text-gray-700">Mekdela Amba University</p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center">
                  <FaClock />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Office Hours</p>
                  <p className="font-medium text-gray-700">Mon-Fri, 9:00 - 5:00</p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1 md:col-span-2">
            <div className="card">
              <h2 className="text-2xl font-semibold text-ieps-blue-600 mb-6">Send a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ieps-blue-500 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ieps-blue-500 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows="5"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ieps-blue-500 transition-all resize-none"
                    required
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="w-full bg-ieps-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-ieps-blue-500 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  <FaPaperPlane />
                  Send Message
                </button>
                {submitted && (
                  <p className="text-green-600 text-center text-sm font-medium">✓ Message sent successfully!</p>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;