/**
 * 统一 API 响应工具
 *
 * 封装了标准化的 JSON 响应格式，确保前后端接口返回格式一致。
 * 所有 API 路由（route.ts）都应使用 success() 和 error() 来返回数据。
 *
 * 成功响应格式：{ code: 200, message: "success", data: T, pagination?: {...} }
 * 错误响应格式：{ code: number, message: string, errors?: [...] }
 */
import { NextResponse } from "next/server";

/**
 * 返回成功响应
 * @param data - 返回给前端的数据（任意类型）
 * @param pagination - 可选的分页信息（列表查询时传入）
 * @returns NextResponse JSON 响应
 */
type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type SuccessOptions = {
  pagination?: Pagination;
  meta?: Record<string, unknown>;
};

export function success<T>(
  data: T,
  options?: Pagination | SuccessOptions,
) {
  const pagination =
    options && "page" in options
      ? options
      : options && "pagination" in options
        ? options.pagination
        : undefined;
  const meta =
    options && "meta" in options && options.meta ? options.meta : undefined;

  return NextResponse.json({
    code: 200,
    message: "success",
    data,
    ...(pagination ? { pagination } : {}),
    ...(meta ? { meta } : {}),
  });
}

/**
 * 返回错误响应
 * @param message - 错误描述信息
 * @param code - HTTP 状态码（默认 400）
 * @param errors - 可选的详细字段错误列表（表单验证时使用）
 * @returns NextResponse JSON 响应
 */
type ErrorOptions = {
  errors?: Array<{ field: string; message: string }>;
  meta?: Record<string, unknown>;
};

export function error(
  message: string,
  code = 400,
  options?: ErrorOptions | Array<{ field: string; message: string }>,
) {
  const normalized = Array.isArray(options) ? { errors: options } : options;

  return NextResponse.json(
    {
      code,
      message,
      ...(normalized?.errors ? { errors: normalized.errors } : {}),
      ...(normalized?.meta ? { meta: normalized.meta } : {}),
    },
    { status: code >= 400 && code < 600 ? code : 400 },
  );
}
