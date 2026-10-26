import pg from 'pg'

/**
 * Chuẩn bị trước khi chạy test (Q3).
 *
 * Dữ liệu seed chèn mã hồ sơ VIẾT TAY nên `application_code_seq` có thể thấp hơn
 * mã lớn nhất đang tồn tại. Đồng bộ lại sequence trước mỗi lượt chạy test để các
 * bài kiểm thử sinh mã mới (next_ma_ho_so()) không đụng vào mã đã có.
 *
 * Chỉ chạy trên CSDL có chữ "test" — không bao giờ đụng CSDL phát triển.
 */
export default async function setup(): Promise<void> {
  const url =
    process.env.DATABASE_URL ??
    'postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'

  if (!url.toLowerCase().includes('test')) {
    throw new Error(
      'TỪ CHỐI CHẠY TEST: DATABASE_URL không chứa "test". ' +
        'Các bài kiểm thử chỉ chạy trên CSDL riêng (ví dụ motcua_test).',
    )
  }

  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query('SELECT sync_ma_ho_so_sequence()')
  } finally {
    await client.end()
  }
}
