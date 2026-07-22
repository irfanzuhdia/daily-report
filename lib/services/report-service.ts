import { DailyReportRepository } from '@/lib/repositories'
import { AppError } from '@/lib/api-response'

export const ReportService = {
  async getAllReports() {
    return await DailyReportRepository.findAll()
  },

  async getReportById(reportId: string) {
    const report = await DailyReportRepository.findById(reportId)
    if (!report) {
      throw new AppError("NOT_FOUND", "Report not found", 404)
    }
    return report
  },

  async createReport(reportData: any, currentUser: { id: string }) {
    const dataToSave = { ...reportData, user_id: currentUser.id }
    return await DailyReportRepository.create(dataToSave, currentUser.id)
  },

  async updateReport(reportId: string, reportData: any, currentUser: { id: string }) {
    const existing = await DailyReportRepository.findById(reportId)
    if (!existing) {
      throw new AppError("NOT_FOUND", "Report not found", 404)
    }

    if (existing.user_id !== currentUser.id && existing.created_by !== currentUser.id) {
      throw new AppError("FORBIDDEN", "You do not have permission to modify this report", 403)
    }

    return await DailyReportRepository.update(reportId, reportData, currentUser.id)
  },

  async deleteReport(reportId: string, currentUser: { id: string }) {
    const existing = await DailyReportRepository.findById(reportId)
    if (!existing) {
      throw new AppError("NOT_FOUND", "Report not found", 404)
    }

    if (existing.user_id !== currentUser.id && existing.created_by !== currentUser.id) {
      throw new AppError("FORBIDDEN", "You do not have permission to delete this report", 403)
    }

    await DailyReportRepository.softDelete(reportId, currentUser.id)
    return { success: true }
  }
}
