import { Mail, Phone, MapPin } from 'lucide-react';

const SupportFooter = () => (
  <div className="container-custom mt-8 rounded-3xl border border-ieps-blue-200 bg-white p-6 text-sm text-gray-700 shadow-sm">
    <div className="grid gap-6 sm:grid-cols-3">
      <div>
        <h3 className="font-semibold text-ieps-blue-700">Support</h3>
        <p className="mt-2 text-gray-600">For assistance with evaluations, please contact Mekdela Amba University support.</p>
      </div>
      <div className="flex items-start gap-3">
        <MapPin className="h-5 w-5 text-ieps-blue-600 mt-1" />
        <p>Mekdela Amba University, Ethiopia</p>
      </div>
      <div className="grid gap-3">
        <div className="flex items-center gap-3">
          <Phone className="h-5 w-5 text-ieps-blue-600" />
          <span>+251 XXX XXX XXX</span>
        </div>
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-ieps-blue-600" />
          <span>ieps@mekdela.edu.et</span>
        </div>
      </div>
    </div>
  </div>
);

export default SupportFooter;
