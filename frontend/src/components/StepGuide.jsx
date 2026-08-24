import { ListOrdered, User, FileText, Send } from 'lucide-react';

const guideSteps = [
  { label: 'Login', icon: User },
  { label: 'Select Instructor', icon: ListOrdered },
  { label: 'Fill Form', icon: FileText },
  { label: 'Submit', icon: Send },
];

const StepGuide = () => (
  <div className="container-custom mt-6 rounded-3xl border border-ieps-blue-200 bg-ieps-blue-50/80 p-4 shadow-sm">
    <h2 className="text-lg font-semibold text-ieps-blue-700">How it works</h2>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {guideSteps.map(({ label, icon: Icon }, index) => (
        <div key={label} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ieps-blue-600 text-white">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ieps-blue-800">{label}</p>
            <p className="text-xs text-gray-500">Step {index + 1}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default StepGuide;
