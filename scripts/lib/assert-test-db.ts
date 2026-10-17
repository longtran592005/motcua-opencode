/**
 * Lớp bảo vệ: mọi công cụ kiểm thử / toàn vẹn dữ liệu
 * chỉ được chạy khi DATABASE_URL chứa chuỗi "test".
 */
export function assertTestDatabaseUrl(url?: string): string {
  const target = arguments.length > 0 ? url : process.env.DATABASE_URL
  if (!target || typeof target !== 'string' || target.trim() === '') {
    throw new Error(
      'TỪ CHỐI: thiếu DATABASE_URL. Hãy trỏ tới CSDL kiểm thử (ví dụ motcua_test), không dùng CSDL phát triển.',
    )
  }
  if (!target.toLowerCase().includes('test')) {
    throw new Error(
      'TỪ CHỐI: DATABASE_URL không chứa "test". ' +
        'Kiểm thử KHÔNG BAO GIỜ được chạy trên CSDL phát triển. ' +
        `Giá trị hiện tại bị che: ${maskDbUrl(target)}`,
    )
  }
  return target
}

export function maskDbUrl(url: string): string {
  return url.replace(/:([^:@/]+)@/, ':***@')
}

export const DEFAULT_TEST_DATABASE_URL =
  'postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'
