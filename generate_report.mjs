import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const connectionString = "postgresql://postgres.gguqhxinkcdzauvitnuf:EzRQvtkiIyr92n50@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function generateReport() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // Find the user
    const userRes = await client.query(`SELECT * FROM users WHERE user_name ILIKE $1`, ['%Irfan Zuhdi Abdillah%']);
    if (userRes.rows.length === 0) {
      console.log("User not found");
      return;
    }
    const user = userRes.rows[0];

    // Find projects (where user is part of project_team or created the project)
    const projectsRes = await client.query(`
      SELECT p.* FROM projects p
      JOIN project_teams pt ON p.project_id = pt.project_id
      WHERE pt.user_id = $1
    `, [user.user_id]);
    const projects = projectsRes.rows;

    // Find tasks
    const tasksRes = await client.query(`
      SELECT t.*, p.project_name FROM tasks t
      JOIN task_teams tt ON t.id = tt.task_id
      LEFT JOIN projects p ON t.project_id = p.project_id
      WHERE tt.user_id = $1
    `, [user.user_id]);
    const tasks = tasksRes.rows;

    // Find daily reports
    const reportsRes = await client.query(`
      SELECT r.*, t.task_description, p.project_name 
      FROM daily_reports r
      LEFT JOIN tasks t ON r.task_id = t.id
      LEFT JOIN projects p ON t.project_id = p.project_id
      WHERE r.user_id = $1
      ORDER BY r.date DESC
    `, [user.user_id]);
    const reports = reportsRes.rows;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Activity Report: ${user.user_name}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 1000px; margin: 0 auto; padding: 20px; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #2980b9; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:hover { background-color: #f5f5f5; }
        .card { background: #fff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 20px; margin-bottom: 20px; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold; background: #e0e0e0; }
    </style>
</head>
<body>
    <h1>Activity Report</h1>
    
    <div class="card">
        <h2>User Profile</h2>
        <p><strong>Name:</strong> ${user.user_name}</p>
        <p><strong>Email:</strong> ${user.user_email}</p>
        <p><strong>Occupation:</strong> ${user.user_occupation || 'N/A'}</p>
        <p><strong>Division/Department:</strong> ${user.user_division || 'N/A'} / ${user.user_departement || 'N/A'}</p>
    </div>

    <div class="card">
        <h2>Projects (${projects.length})</h2>
        <table>
            <tr>
                <th>Project Name</th>
                <th>Status</th>
                <th>Start Date</th>
                <th>End Date</th>
            </tr>
            ${projects.map(p => `
            <tr>
                <td>${p.project_name}</td>
                <td><span class="badge">${p.project_status}</span></td>
                <td>${p.project_start_date_plan ? new Date(p.project_start_date_plan).toLocaleDateString() : 'N/A'}</td>
                <td>${p.project_end_date_plan ? new Date(p.project_end_date_plan).toLocaleDateString() : 'N/A'}</td>
            </tr>`).join('')}
            ${projects.length === 0 ? '<tr><td colspan="4" style="text-align:center;">No projects found</td></tr>' : ''}
        </table>
    </div>

    <div class="card">
        <h2>Tasks (${tasks.length})</h2>
        <table>
            <tr>
                <th>Project</th>
                <th>Task Description</th>
                <th>Status</th>
                <th>Progress</th>
            </tr>
            ${tasks.map(t => `
            <tr>
                <td>${t.project_name || 'N/A'}</td>
                <td>${t.task_description}</td>
                <td><span class="badge">${t.task_status}</span></td>
                <td>${t.task_latest_percentage || 0}%</td>
            </tr>`).join('')}
            ${tasks.length === 0 ? '<tr><td colspan="4" style="text-align:center;">No tasks found</td></tr>' : ''}
        </table>
    </div>

    <div class="card">
        <h2>Daily Reports (${reports.length})</h2>
        <table>
            <tr>
                <th>Date</th>
                <th>Project / Task</th>
                <th>Progress</th>
                <th>Remarks</th>
            </tr>
            ${reports.map(r => `
            <tr>
                <td>${new Date(r.date).toLocaleDateString()}</td>
                <td><strong>${r.project_name || 'N/A'}</strong><br>${r.task_description || 'N/A'}</td>
                <td>${r.progress_percentage || 0}%</td>
                <td>${r.remarks || ''}</td>
            </tr>`).join('')}
            ${reports.length === 0 ? '<tr><td colspan="4" style="text-align:center;">No reports found</td></tr>' : ''}
        </table>
    </div>
    
    <footer style="text-align: center; margin-top: 40px; color: #7f8c8d; font-size: 0.9em;">
        Generated on ${new Date().toLocaleString()}
    </footer>
</body>
</html>
    `;

    fs.writeFileSync('report_irfan_zuhdi_abdillah.html', html);
    console.log("Report generated at report_irfan_zuhdi_abdillah.html");

  } catch (err) {
    console.error("Error generating report:", err);
  } finally {
    await client.end();
  }
}

generateReport();
