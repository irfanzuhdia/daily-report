import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  ProjectRepository,
  UserRepository,
  TaskRepository,
  DailyReportRepository,
  getContributionData,
  getCategoryContributionData,
  getProjectContributionData,
  getTaskContributionData,
  filterProjectsByUser,
} from "@/lib/repositories"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { ContributionCalendar } from "./analytics-client"

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    user_id?: string
    created_by?: string
    dept_filter?: string
    site_filter?: string
    div_filter?: string
    team_filter?: string
    project_id?: string
    start_date?: string
    end_date?: string
    preset?: string
  }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const viewMode = await getViewModeFromCookies()
  const userId = session.user_id
  const params = await searchParams

  const [allProjects, users, tasks, reports] = await Promise.all([
    ProjectRepository.findAll(),
    UserRepository.findAll(),
    TaskRepository.findAll(),
    DailyReportRepository.findAll()
  ])

  // Filter projects by user when in "my" view
  const projects = viewMode === "my"
    ? await filterProjectsByUser(allProjects, userId)
    : allProjects

  // Base variables
  let filteredReports = reports

  // Create lookup maps
  const userById = new Map(users.map((u) => [u.user_id, u]))
  const userMap = new Map(users.map(u => [u.user_id, u.user_name || u.user_email || u.user_id]))

  // Apply Team View Filters (Created by, Dept, Site, Div, Team)
  if (viewMode === "team") {
    const currentUser = users.find(u => u.user_id === userId)
    const userLevel = currentUser?.level || 1

    const isDeptDisabled = userLevel < 6
    const isSiteDisabled = userLevel < 5
    const isDivDisabled = userLevel < 3
    const isTeamDisabled = userLevel < 2

    if (params.created_by) {
      filteredReports = filteredReports.filter(r => r.user_id === params.created_by || r.created_by === params.created_by)
    }
    
    if (isDeptDisabled || params.dept_filter) {
      const targetDept = isDeptDisabled ? (currentUser?.user_departement || "") : params.dept_filter
      filteredReports = filteredReports.filter(r => (userById.get(r.user_id || "")?.user_departement || "") === targetDept)
    }
    if (isSiteDisabled || params.site_filter) {
      const targetSite = isSiteDisabled ? (currentUser?.user_site || "") : params.site_filter
      filteredReports = filteredReports.filter(r => (userById.get(r.user_id || "")?.user_site || "") === targetSite)
    }
    if (isDivDisabled || params.div_filter) {
      const targetDiv = isDivDisabled ? (currentUser?.user_division || "") : params.div_filter
      filteredReports = filteredReports.filter(r => (userById.get(r.user_id || "")?.user_division || "") === targetDiv)
    }
    if (isTeamDisabled || params.team_filter) {
      const targetTeam = isTeamDisabled ? (currentUser?.user_team || "") : params.team_filter
      filteredReports = filteredReports.filter(r => (userById.get(r.user_id || "")?.user_team || "") === targetTeam)
    }
  } else {
    // "my" view
    filteredReports = filteredReports.filter(r => r.user_id === userId)
  }

  // Apply Project Filter
  if (params.project_id) {
    const projectTaskIds = tasks.filter(t => t.project_id === params.project_id).map(t => t.id)
    filteredReports = filteredReports.filter(r => projectTaskIds.includes(r.task_id))
  }

  // Apply Date Filter
  if (params.start_date) {
    filteredReports = filteredReports.filter(r => r.date && r.date >= params.start_date!)
  }
  if (params.end_date) {
    filteredReports = filteredReports.filter(r => r.date && r.date <= params.end_date!)
  }

  // Aggregate Data in JS for Heatmap and Pie Charts
  const contributionData: Record<string, number> = {}
  const categoryMap = new Map<string, number>()
  const projectMap = new Map<string, number>()
  const taskMap = new Map<string, number>()

  for (const r of filteredReports) {
    const hours = parseFloat(r.total_hours ?? '0')
    if (isNaN(hours) || hours <= 0) continue

    // Heatmap (by date)
    if (r.date) {
      contributionData[r.date] = (contributionData[r.date] || 0) + hours
    }

    const task = tasks.find(t => t.id === r.task_id)
    const project = task ? projects.find(p => p.project_id === task.project_id) : null

    // Category Pie Chart
    const catName = project?.category ?? 'Uncategorized'
    categoryMap.set(catName, (categoryMap.get(catName) || 0) + hours)

    // Project Pie Chart
    const projName = project?.project_name ?? 'No Project'
    projectMap.set(projName, (projectMap.get(projName) || 0) + hours)

    // Task Pie Chart
    const taskName = task?.task_description ?? 'No Task'
    taskMap.set(taskName, (taskMap.get(taskName) || 0) + hours)
  }

  const categoryContribution = Array.from(categoryMap.entries()).map(([category, hours]) => ({ category, hours }))
  const projectContribution = Array.from(projectMap.entries()).map(([project_name, hours]) => ({ project_name, hours }))
  const taskContribution = Array.from(taskMap.entries()).map(([task_name, hours]) => ({ task_name, hours }))

  // Time Distribution Tree Aggregation
  type TreeNode = {
    id: string;
    name: string;
    type: 'category' | 'project' | 'task' | 'report';
    hours: number;
    children?: TreeNode[];
    subtitle?: string;
  };

  const categoryNodes = new Map<string, TreeNode>();

  for (const r of filteredReports) {
    const hours = parseFloat(r.total_hours ?? '0');
    if (isNaN(hours) || hours <= 0) continue;

    const task = tasks.find(t => t.id === r.task_id);
    const project = task ? projects.find(p => p.project_id === task.project_id) : null;
    const catName = project?.category ?? 'Uncategorized';
    
    let catNode = categoryNodes.get(catName);
    if (!catNode) {
      catNode = { id: `cat-${catName}`, name: catName, type: 'category', hours: 0, children: [] };
      categoryNodes.set(catName, catNode);
    }
    catNode.hours += hours;

    const projId = project?.project_id ?? 'unassigned-proj';
    const projName = project?.project_name ?? 'No Project';
    let projNode = catNode.children!.find(c => c.id === projId);
    if (!projNode) {
      projNode = { id: projId, name: projName, type: 'project', hours: 0, children: [] };
      catNode.children!.push(projNode);
    }
    projNode.hours += hours;

    const taskId = task?.id ?? 'unassigned-task';
    const taskName = task?.task_description ?? 'No Task';
    let taskNode = projNode.children!.find(c => c.id === taskId);
    if (!taskNode) {
      taskNode = { id: taskId, name: taskName, type: 'task', hours: 0, children: [] };
      projNode.children!.push(taskNode);
    }
    taskNode.hours += hours;

    taskNode.children!.push({
      id: r.report_id,
      name: r.remarks ?? 'No Activity',
      type: 'report',
      hours: hours,
      subtitle: `${r.date ?? ''} - ${userMap.get(r.user_id ?? '') ?? 'Unknown User'}`
    });
  }

  const sortByHours = (a: TreeNode, b: TreeNode) => b.hours - a.hours;
  const timeDistributionTree = Array.from(categoryNodes.values()).map(cat => {
    cat.children!.forEach(proj => {
      proj.children!.forEach(task => {
        task.children!.sort(sortByHours);
      });
      proj.children!.sort(sortByHours);
    });
    cat.children!.sort(sortByHours);
    return cat;
  }).sort(sortByHours);

  return (
    <ContributionCalendar
      data={contributionData}
      categoryData={categoryContribution}
      projectData={projectContribution}
      taskData={taskContribution}
      timeDistributionTree={timeDistributionTree}
      projects={projects}
      users={users.map((u) => ({
        user_id: u.user_id,
        user_name: u.user_name,
        user_email: u.user_email,
        user_departement: u.user_departement,
        user_site: u.user_site,
        user_division: u.user_division,
        user_team: u.user_team,
        level: u.level
      }))}
      viewMode={viewMode}
      currentStartDate={params.start_date}
      currentEndDate={params.end_date}
      currentPreset={params.preset}
      currentProjectId={params.project_id}
      currentUserId={userId}
      currentCreatedBy={params.created_by}
      currentDept={params.dept_filter}
      currentSite={params.site_filter}
      currentDiv={params.div_filter}
      currentTeam={params.team_filter}
    />
  )
}
