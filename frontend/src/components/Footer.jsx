import React from 'react';
import { FaFacebook, FaTwitter, FaLinkedin, FaTelegram, FaEnvelope, FaPhone, FaMapMarkerAlt } from 'react-icons/fa';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0f1f42] text-white">
      
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 items-center">
          <div className="hidden md:block" />

          <div className="flex flex-col items-center justify-center text-center">
            <h3 className="text-xl font-semibold text-white">Follow Us</h3>
            <div className="mt-2">
              {/* <div className="inline-block bg-white/10 text-white/80 rounded-full px-4 py-2 text-sm">
                Instructor Performance Evaluation System
              </div> */}
            </div>
            <div className="mt-6">
              <div className="inline-flex items-center justify-center gap-3 bg-white/10 border border-white/15 rounded-full px-4 py-3">
                <a href="https://www.facebook.com/MekdelaAmbaUniversity" target="_blank" rel="noreferrer noopener" className="text-white/70 hover:text-white transition-colors"><FaFacebook className="w-5 h-5" /></a>
                <a href="https://twitter.com/MekdelaAmbaUni" target="_blank" rel="noreferrer noopener" className="text-white/70 hover:text-white transition-colors"><FaTwitter className="w-5 h-5" /></a>
                <a href="https://t.me/mekdelaamba" target="_blank" rel="noreferrer noopener" className="text-white/70 hover:text-white transition-colors"><FaTelegram className="w-5 h-5" /></a>
                <a href="https://www.linkedin.com/school/mekdela-amba-university" target="_blank" rel="noreferrer noopener" className="text-white/70 hover:text-white transition-colors"><FaLinkedin className="w-5 h-5" /></a>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="bg-white/10 rounded-3xl px-5 py-4 text-left border border-white/10">
              <h4 className="text-white font-semibold mb-3">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 justify-end text-white/70">
                  <FaMapMarkerAlt className="text-ieps-gold-500" />
                  Mekdela Amba University, Ethiopia
                </li>
                <li className="flex items-center gap-2 justify-end text-white/70">
                  <FaPhone className="text-ieps-gold-500" />
                  +251 961806188
                </li>
                <li className="flex items-center gap-2 justify-end text-white/70">
                  <FaEnvelope className="text-ieps-gold-500" />
                  ieps@mekdela.edu.et
                </li>
              </ul>
            </div>
          </div>
        </div>

     <div className="border-t border-white/10 py-3 text-center text-sm font-medium text-slate-900 bg-sky-400">
  <p>&copy; {currentYear} Mekdela Amba University. All Rights Reserved.</p>
</div>
      
    </footer>
  );
};

export default Footer;
