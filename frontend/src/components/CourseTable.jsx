import React, { useState, useContext } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LanguageContext } from '../context/LanguageContext';

const CourseTable = () => {
  const { language } = useContext(LanguageContext);
  const [currentPage, setCurrentPage] = useState(1);

  // Sample course data
  const allCourses = [
    { id: 1, code: 'CS101', title: 'Introduction to Programming', instructor: 'Dr. Ahmed', students: 45, status: 'Active' },
    { id: 2, code: 'CS102', title: 'Data Structures', instructor: 'Dr. Fatima', students: 38, status: 'Active' },
    { id: 3, code: 'CS103', title: 'Web Development', instructor: 'Dr. Kebede', students: 52, status: 'Active' },
    { id: 4, code: 'CS104', title: 'Database Systems', instructor: 'Dr. Zainab', students: 41, status: 'Active' },
    { id: 5, code: 'CS105', title: 'Software Engineering', instructor: 'Dr. Tesfaye', students: 35, status: 'Active' },
    { id: 6, code: 'CS106', title: 'Mobile Development', instructor: 'Dr. Alemayehu', students: 48, status: 'Ongoing' },
    { id: 7, code: 'CS107', title: 'Machine Learning', instructor: 'Dr. Hafiz', students: 30, status: 'Upcoming' },
    { id: 8, code: 'CS108', title: 'Cloud Computing', instructor: 'Dr. Nadia', students: 42, status: 'Active' },
    { id: 9, code: 'CS109', title: 'Cybersecurity', instructor: 'Dr. Yusuf', students: 38, status: 'Active' },
    { id: 10, code: 'CS110', title: 'AI Fundamentals', instructor: 'Dr. Leila', students: 55, status: 'Ongoing' },
    { id: 11, code: 'CS111', title: 'Network Administration', instructor: 'Dr. Hassan', students: 33, status: 'Active' },
    { id: 12, code: 'CS112', title: 'Advanced Python', instructor: 'Dr. Sophia', students: 44, status: 'Active' },
    { id: 13, code: 'CS113', title: 'Cloud Architecture', instructor: 'Dr. Marcus', students: 36, status: 'Upcoming' },
    { id: 14, code: 'CS114', title: 'DevOps Essentials', instructor: 'Dr. Elena', students: 40, status: 'Active' },
    { id: 15, code: 'CS115', title: 'API Development', instructor: 'Dr. Ibrahim', students: 50, status: 'Ongoing' },
    { id: 16, code: 'CS116', title: 'Blockchain Basics', instructor: 'Dr. Aisha', students: 28, status: 'Active' },
    { id: 17, code: 'CS117', title: 'Data Science 101', instructor: 'Dr. Jamal', students: 46, status: 'Active' },
    { id: 18, code: 'CS118', title: 'IoT Applications', instructor: 'Dr. Mira', students: 32, status: 'Upcoming' },
    { id: 19, code: 'CS119', title: 'Game Development', instructor: 'Dr. Ravi', students: 53, status: 'Active' },
    { id: 20, code: 'CS120', title: 'Quantum Computing', instructor: 'Dr. Priya', students: 25, status: 'Ongoing' },
  ];

  const itemsPerPage = 5;
  const totalPages = Math.ceil(allCourses.length / itemsPerPage);

  // Calculate pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCourses = allCourses.slice(startIndex, endIndex);

  // Navigation handlers
  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageClick = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Bilingual text
  const labels = {
    myCourses: language === 'en' ? 'My Courses' : 'የእኔ ኮርሶች',
    courseCode: language === 'en' ? 'Course Code' : 'ኮርስ ኮድ',
    title: language === 'en' ? 'Title' : 'ርእስ',
    instructor: language === 'en' ? 'Instructor' : 'መምህር',
    students: language === 'en' ? 'Students' : 'ተማሪዎች',
    status: language === 'en' ? 'Status' : 'ሁኔታ',
    previous: language === 'en' ? 'Previous' : 'ቀዳሚ',
    next: language === 'en' ? 'Next' : 'ቀጣይ',
    showing: language === 'en' ? 'Showing' : 'ከ',
    to: language === 'en' ? 'to' : 'ወደ',
    of: language === 'en' ? 'of' : 'ውስጥ',
    courses: language === 'en' ? 'courses' : 'ኮርሶች',
  };

  // Status badge styling
  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Ongoing':
        return 'bg-blue-100 text-blue-800';
      case 'Upcoming':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= maxPagesToShow; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - maxPagesToShow + 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="w-full bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-ieps-blue-50 to-gray-50 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-ieps-blue-700">{labels.myCourses}</h2>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-ieps-blue-600 text-white">
              <th className="px-6 py-3 text-left text-sm font-semibold">{labels.courseCode}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">{labels.title}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">{labels.instructor}</th>
              <th className="px-6 py-3 text-center text-sm font-semibold">{labels.students}</th>
              <th className="px-6 py-3 text-center text-sm font-semibold">{labels.status}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentCourses.map((course, index) => (
              <tr
                key={course.id}
                className={`hover:bg-gray-50 transition-colors duration-200 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                }`}
              >
                <td className="px-6 py-4 text-sm font-medium text-ieps-blue-700">{course.code}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{course.title}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{course.instructor}</td>
                <td className="px-6 py-4 text-sm text-center text-gray-700">{course.students}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(course.status)}`}>
                    {course.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-ieps-blue-50 border-t border-gray-200">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Summary Text */}
          <div className="text-sm text-gray-600 font-medium">
            {labels.showing} {startIndex + 1} {labels.to} {Math.min(endIndex, allCourses.length)} {labels.of} {allCourses.length} {labels.courses}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={handlePrevious}
              disabled={currentPage === 1}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                currentPage === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-ieps-blue-600 text-white hover:bg-ieps-blue-700 hover:shadow-md'
              }`}
            >
              <ChevronLeft size={18} />
              <span className="hidden sm:inline">{labels.previous}</span>
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {getPageNumbers().map((page, index) => (
                <button
                  key={index}
                  onClick={() => typeof page === 'number' && handlePageClick(page)}
                  disabled={page === '...'}
                  className={`w-10 h-10 rounded-lg font-medium transition-all duration-200 ${
                    page === '...'
                      ? 'text-gray-400 cursor-default'
                      : page === currentPage
                      ? 'bg-ieps-gold-500 text-white shadow-md'
                      : 'bg-gray-100 text-ieps-blue-700 hover:bg-ieps-blue-100'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            {/* Next Button */}
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                currentPage === totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-ieps-blue-600 text-white hover:bg-ieps-blue-700 hover:shadow-md'
              }`}
            >
              <span className="hidden sm:inline">{labels.next}</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseTable;
