import { 
  ProjectRepository, 
  ProjectTeamRepository, 
  TaskRepository,
  DailyReportRepository,
  NotificationRepository, 
  hasProjectWritePermission 
} from '@/lib/repositories'
import { AppError } from '@/lib/api-response'

export const ProjectService = {
  async getAllProjects() {
    return await ProjectRepository.findAll()
  },

  async getProjectById(projectId: string) {
    const project = await ProjectRepository.findById(projectId)
    if (!project) {
      throw new AppError("NOT_FOUND", "Project not found", 404)
    }
    return project
  },

  async createProject(projectData: any, teamUserIds: string[] | undefined, currentUser: { id: string, name: string }) {
    const project = await ProjectRepository.create(projectData, currentUser.id)

    if (teamUserIds && Array.isArray(teamUserIds)) {
      for (const userId of teamUserIds) {
        await ProjectTeamRepository.create(project.project_id, userId, currentUser.id)
        if (userId !== currentUser.id) {
          await NotificationRepository.create({
            user_id: userId,
            type: 'project_created',
            title: 'Assigned to Project',
            content: `${currentUser.name} added you to the project: ${project.project_name}`,
            link: `/projects/${project.project_id}`
          })
        }
      }
    }

    return project
  },

  async updateProject(projectId: string, projectData: any, teamUserIds: string[] | undefined, currentUser: { id: string }) {
    const hasWrite = await hasProjectWritePermission(projectId, currentUser.id)
    if (!hasWrite) {
      throw new AppError("FORBIDDEN", "You do not have permission to modify this project", 403)
    }

    const updatedProject = await ProjectRepository.update(projectId, projectData, currentUser.id)
    if (!updatedProject) {
      throw new AppError("NOT_FOUND", "Project not found", 404)
    }

    if (teamUserIds !== undefined) {
      const currentTeam = await ProjectTeamRepository.findByProjectId(projectId)
      const currentUserIds = new Set(currentTeam.map((pt: any) => pt.user_id))
      const newUserIds = new Set(teamUserIds || [])

      for (const pt of currentTeam) {
        if (!newUserIds.has(pt.user_id)) {
          await ProjectTeamRepository.softDelete(pt.id, currentUser.id)
        }
      }

      for (const userId of teamUserIds || []) {
        if (!currentUserIds.has(userId)) {
          await ProjectTeamRepository.create(projectId, userId, currentUser.id)
        }
      }
    }

    return updatedProject
  },

  async deleteProject(projectId: string, currentUser: { id: string }) {
    const hasWrite = await hasProjectWritePermission(projectId, currentUser.id)
    if (!hasWrite) {
      throw new AppError("FORBIDDEN", "You do not have permission to delete this project", 403)
    }

    const tasks = await TaskRepository.findByProjectId(projectId)
    for (const task of tasks) {
      const reports = await DailyReportRepository.findByTaskId(task.id)
      if (reports && reports.length > 0) {
        throw new AppError("BAD_REQUEST", "Cannot delete project because it has tasks with associated reports.", 400)
      }
    }

    await ProjectRepository.softDelete(projectId, currentUser.id)
    return { success: true }
  }
}
