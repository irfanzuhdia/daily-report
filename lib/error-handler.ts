import { NextResponse } from "next/server"
import { AppError, createErrorResponse } from "./api-response"
import { ZodError } from "zod"
import { logger } from "@/lib/logger"

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return createErrorResponse(error.code, error.message, error.status, error.details)
  }

  if (error instanceof ZodError) {
    return createErrorResponse("VALIDATION_ERROR", "Validation failed", 400, error.flatten().fieldErrors)
  }

  logger.error("Unhandled API Error:", error)
  return createErrorResponse("INTERNAL_ERROR", "Internal Server Error", 500)
}
