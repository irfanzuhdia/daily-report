import { TaskRepository, TaskTeamRepository, NotificationRepository, DailyReportRepository, hasTaskWritePermission } from '@/lib/repositories'
import { AppError } from '@/lib/api-response'

export const TaskService = {
  async getAllTasks() {
    return await TaskRepository.findAll()
  },

  async getTaskById(taskId: string) {
    const task = await TaskRepository.findById(taskId)
    if (!task) {
      throw new AppError("NOT_FOUND", "Task not found", 404)
    }
    return task
  },

  async createTask(taskData: any, taskUserIds: string[] | undefined, currentUser: { id: string, name: string }) {
    const task = await TaskRepository.create(taskData, currentUser.id)

    if (taskUserIds && Array.isArray(taskUserIds)) {
      const desc = task.task_description || ''
      const truncatedDesc = desc.length > 60 ? desc.substring(0, 60) + '...' : desc
      
      for (const userId of taskUserIds) {
        await TaskTeamRepository.create(task.id, userId, currentUser.id)
        if (userId !== currentUser.id) {
          await NotificationRepository.create({
            user_id: userId,
            type: 'task_created',
            title: 'Assigned to Task',
            content: `${currentUser.name} assigned you to the task: "${truncatedDesc}"`,
            link: `/tasks/${task.id}`
          })
        }
      }
    }

    return task
  },

  async updateTask(taskId: string, taskData: any, taskUserIds: string[] | undefined, currentUser: { id: string }) {
    const hasWrite = await hasTaskWritePermission(taskId, currentUser.id)
    if (!hasWrite) {
      throw new AppError("FORBIDDEN", "You do not have permission to modify this task", 403)
    }

    const updatedTask = await TaskRepository.update(taskId, taskData, currentUser.id)
    if (!updatedTask) {
      throw new AppError("NOT_FOUND", "Task not found", 404)
    }

    if (taskUserIds !== undefined) {
      const currentTeam = await TaskTeamRepository.findByTaskId(taskId)
      const currentUserIds = new Set(currentTeam.map((tt: any) => tt.user_id))
      const newUserIds = new Set(taskUserIds || [])

      for (const tt of currentTeam) {
        if (!newUserIds.has(tt.user_id)) {
          await TaskTeamRepository.softDelete(tt.id, currentUser.id)
        }
      }

      for (const userId of taskUserIds || []) {
        if (!currentUserIds.has(userId)) {
          await TaskTeamRepository.create(taskId, userId, currentUser.id)
        }
      }
    }

    return updatedTask
  },

  async deleteTask(taskId: string, currentUser: { id: string }) {
    const hasWrite = await hasTaskWritePermission(taskId, currentUser.id)
    if (!hasWrite) {
      throw new AppError("FORBIDDEN", "You do not have permission to delete this task", 403)
    }

    const reports = await DailyReportRepository.findByTaskId(taskId)
    if (reports && reports.length > 0) {
      throw new AppError("BAD_REQUEST", "Cannot delete task because it has associated reports.", 400)
    }

    await TaskRepository.softDelete(taskId, currentUser.id)
    return { success: true }
  }
}
