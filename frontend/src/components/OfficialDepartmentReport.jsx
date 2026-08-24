const OfficialDepartmentReport = ({ departmentName, academicYear, semester, reportRow, referenceNumber, reportDate }) => {
  const row = reportRow || {};
  const scoreRows = [
    ['Evaluation by Students', '50%', row.studentScore],
    ['Evaluation by colleagues', '20%', row.peerScore],
    ['Evaluation by department head', '30%', row.deptHeadScore],
  ];

  return (
  <article className="official-report" aria-label="Official department evaluation report">
    <header className="official-report__header">
      <div className="official-report__brand-mark">MAU</div>
      <div>
        <h1>Mekdela Amba University</h1>
        <p>College of Natural and Computational Science</p>
        <p>Department of {departmentName || '________________'}</p>
      </div>
      <div className="official-report__amharic">የመክደላ አምባ ዩኒቨርሲቲ<br />የትምህርት ጥራት ማረጋገጫ</div>
    </header>

    <div className="official-report__rule" />
    <div className="official-report__meta">
      <span>Ref. No: {referenceNumber || 'MAU/IPES/________'}</span>
      <span>Date: {reportDate || new Date().toLocaleDateString()}</span>
    </div>

    <p className="official-report__recipient">To: {row.instructorName || '________________'}</p>
    <p className="official-report__recipient">Department of {departmentName || '________________'}</p>
    <h2>Subject: To notify instructor performance evaluation result</h2>
    <p>
      The Department of {departmentName || '________________'} would like to inform you of the {semester || 'selected semester'} instructor performance evaluation result in the {academicYear || 'academic year'} academic year. The summary of the overall evaluation is presented below.
    </p>

    <table className="official-report__table">
      <thead><tr><th>S/No</th><th>Evaluation type</th><th>Value</th><th>Result</th></tr></thead>
      <tbody>
        {scoreRows.map(([label, weight, score], index) => <tr key={label}><td>{index + 1}</td><td><strong>{label}</strong></td><td>{weight}</td><td>{Number(score || 0).toFixed(2)}</td></tr>)}
        <tr><td colSpan="3" className="official-report__total-label">Total Score</td><td><strong>{Number(row.finalScore || 0).toFixed(2)}</strong></td></tr>
      </tbody>
    </table>

    <p>Based on the evaluation result above, the instructor's overall performance score is <strong>{Number(row.finalScore || 0).toFixed(2)}%</strong>.</p>

    <div className="official-report__signature">
      <div><strong>With best regards,</strong><br /><br /><br />____________________________<br />Department Head<br />Department of {departmentName || '________________'}</div>
      <div className="official-report__stamp">OFFICIAL<br />DEPARTMENT<br />STAMP</div>
    </div>
    <div className="official-report__cc"><strong>CC:</strong><br />- Department of {departmentName || '________________'}<br />- College of Natural and Computational Science<br />- Office of Educational Quality Assurance<br />- Human Resource Development Directorate</div>
  </article>
  );
};

export default OfficialDepartmentReport;
