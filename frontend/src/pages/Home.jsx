import { useContext, useEffect, useState } from 'react';
import { BarChart3, Users, Building2, TrendingUp } from 'lucide-react';
import { LanguageContext } from '../context/LanguageContext';
import { publicApi } from '../services/api';

import ImageSlider from '../components/ImageSlider';

const Home = () => {
  const { language } = useContext(LanguageContext);
  const [systemStats, setSystemStats] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadSystemStats = async () => {
      try {
        const stats = await publicApi.getSystemStats();
        if (isMounted) setSystemStats(stats);
      } catch (error) {
        console.error('Unable to load public system statistics:', error);
        if (isMounted) setSystemStats({});
      }
    };

    void loadSystemStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const stats = [
    {
      id: 1,
      label: language === 'en' ? 'Evaluations Completed' : 'የተጠናቀቁ ግምገማዎች',
      value: systemStats?.evaluationsCompleted,
      icon: BarChart3,
      color: 'blue',
    },
    {
      id: 2,
      label: language === 'en' ? 'Active Instructors' : 'ንቁ መምህራን',
      value: systemStats?.activeInstructors,
      icon: Users,
      color: 'gold',
    },
    {
      id: 3,
      label: language === 'en' ? 'Departments' : 'ክፍሎች',
      value: systemStats?.totalDepartments,
      icon: Building2,
      color: 'blue',
    },
    {
      id: 4,
      label: language === 'en' ? 'Student Participation' : 'የተማሪ ተሳትፎ',
      value: systemStats?.studentParticipation !== undefined ? `${systemStats.studentParticipation}%` : undefined,
      icon: TrendingUp,
      color: 'gold',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <ImageSlider />
      </section>

      {/* 2. Dashboard Stats Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-blue-900 mb-2">
              {language === 'en' ? 'System Overview' : 'የሥርዓቱ አጠቃላይ እይታ'}
            </h2>
            <p className="text-gray-600 italic">
              {language === 'en'
                ? 'Key metrics and performance indicators'
                : 'ቁልፍ መለኪያዎች እና የአፈጻጸም አመልካቾች'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat) => {
              const Icon = stat.icon;
              const isBlue = stat.color === 'blue';
              return (
                <div
                  key={stat.id}
                  className={`rounded-3xl p-6 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 ${
                    isBlue
                      ? 'bg-gradient-to-br from-blue-700 to-blue-900 text-white'
                      : 'bg-gradient-to-br from-amber-400 to-amber-500 text-blue-900'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <p className={`text-sm font-semibold ${isBlue ? 'text-blue-100' : 'text-blue-800'}`}>
                      {stat.label}
                    </p>
                    <Icon className="w-6 h-6 opacity-80" />
                  </div>
                  <p className="text-3xl md:text-4xl font-bold" aria-live="polite">
                    {stat.value === undefined ? <span className="inline-block h-10 w-24 animate-pulse rounded bg-white/30" aria-label="Loading" /> : stat.value}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;