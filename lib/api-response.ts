import { NextResponse } from "next/server"

export type ErrorCode = 
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"
  | "FORBIDDEN"
  | "BAD_REQUEST"

export interface ApiError {
  code: ErrorCode
  message: string
  details?: Record<string, string[]> | any
}

export class AppError extends Error {
  public code: ErrorCode
  public status: number
  public details?: any

  constructor(code: ErrorCode, message: string, status: number = 400, details?: any) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function createErrorResponse(code: ErrorCode, message: string, status: number, details?: any) {
  const error: ApiError = { code, message }
  if (details) error.details = details
  return NextResponse.json({ error }, { status })
}

export function createSuccessResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status })
}
