import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

const roleTitleMap = {
	systemadmin: 'System Administrator',
	depthead: 'Department Head',
	student: 'Student',
	instructor: 'Instructor',
	college_dean: 'College Dean',
	academic_directorate: 'Academic Directorate',
};

const DashboardLayout = ({
	role = 'depthead',
	subtitle,
	statsCards = [],
	children,
}) => {
	const roleTitle = roleTitleMap[role] || 'User';

	return (
		<div className="min-h-screen bg-slate-50 text-slate-900">
			<Header />

			<div className="flex min-h-[calc(100vh-4rem)] overflow-hidden pt-16">
				<Sidebar role={role} />
				<main className="flex-1 overflow-y-auto bg-slate-50">
					<div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-4 lg:px-8 lg:py-8">
						{subtitle ? (
							<div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
								<p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">{roleTitle}</p>
								<p className="mt-2 text-sm text-slate-600">{subtitle}</p>
							</div>
						) : null}

						{statsCards.length ? (
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
								{statsCards.map((card) => {
									const Icon = card.icon;
									return (
										<div key={card.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
											<div className="flex items-start justify-between gap-3">
												<div>
													<p className="text-sm font-medium text-slate-500">{card.title}</p>
													<p className="mt-3 text-2xl font-semibold text-slate-900">{card.value}</p>
												</div>
												<div className={`rounded-2xl p-2 ${card.iconClassName || 'bg-blue-50 text-blue-600'}`}>
													{Icon ? <Icon className="h-5 w-5" /> : null}
												</div>
											</div>
											{card.detail ? <p className="mt-3 text-sm text-slate-500">{card.detail}</p> : null}
										</div>
									);
								})}
							</div>
						) : null}

						<div className="space-y-6">{children || <Outlet />}</div>
					</div>
				</main>
			</div>
		</div>
	);
};

export default DashboardLayout;

