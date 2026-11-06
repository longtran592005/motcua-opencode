/**
 * Kiểm thử hộp mục 2 (gate nút nộp online theo form-map) và mục 3 (ngưỡng
 * truy xuất tuyệt đối). KHÔNG tạo/xóa dữ liệu CSDL — chỉ đọc (searchKnowledge
 * + form-map.json). Không gọi Gemini.
 */
import { describe, expect, it } from 'vitest'
import { env } from '../../src/config/env'
import { searchKnowledge } from '../../src/modules/chatbot/retrieval'
import {
  GOI_Y_TRUNG_BINH,
  allFormMapEntries,
  entryByBieuMau,
  gateNopOnlineFor,
} from '../../src/modules/chatbot/formmap'

describe('Q3/6 — ngưỡng truy xuất tuyệt đối: câu ngoài phạm vi không đạt ngưỡng', () => {
  it('câu xã giao/không liên quan trả về RỖNG với minScore = CHAT_MIN_SCORE', async () => {
    expect(env.CHAT_MIN_SCORE).toBeGreaterThan(0)
    for (const q of ['hom nay thoi tiet the nao, co mua khong?', 'giup em sua loi ham python tinh tong day so']) {
      const res = await searchKnowledge(q, { topK: 5, minScore: env.CHAT_MIN_SCORE })
      expect(res).toEqual([])
    }
  })

  it('câu có hợp lệ vẫn trả kết quả qua cùng ngưỡng (ngưỡng không lọc nhầm mọi câu)', async () => {
    const res = await searchKnowledge('Em xin cấp bảng điểm thì nộp đơn gì?', { topK: 5, minScore: env.CHAT_MIN_SCORE })
    expect(res.length).toBeGreaterThanOrEqual(1)
    expect(res[0]!.score).toBeGreaterThanOrEqual(env.CHAT_MIN_SCORE)
  })
})

describe('Q2/6 — form-map: hạn mức nút nộp online theo độ tin cậy', () => {
  it('cặp trung-binh (rt_dcn chuyển ngành) KHÔNG được gắn nút nộp online', () => {
    expect(gateNopOnlineFor('rt_dcn')).toBe('trung-binh')
  })

  it('cặp tin cậy cao (rt_dbt bảng điểm) giữ nút nộp online', () => {
    expect(gateNopOnlineFor('rt_dbt')).toBe('cao')
  })

  it('cặp theo tên biểu mẫu đúng thủ tục và mang lời khuyên chuẩn cho trung-binh', () => {
    const trung = entryByBieuMau('Đơn xin chuyển lớp')
    expect(trung).not.toBeNull()
    expect(trung!.maLoaiDon).toBe('rt_dcn')
    expect(trung!.doTinCay).toBe('trung-binh')
    const cao = entryByBieuMau('Đơn xin cấp bảng điểm')
    expect(cao!.maLoaiDon).toBe('rt_dbt')
    expect(cao!.doTinCay).toBe('cao')
    expect(GOI_Y_TRUNG_BINH).toContain('nộp trực tuyến tại mục Dịch vụ Một cửa')
  })

  it('cấu trúc form-map: không còn cặp CHẾT công tác/chuyển ngạch, mọi dòng có xacNhanBoi rỗng mặc định', () => {
    const all = allFormMapEntries()
    expect(all.length).toBe(77)
    for (const e of all) {
      expect(typeof e.xacNhanBoi).toBe('string')
      if (e.maLoaiDon) {
        // Biểu mẫu cán bộ (chuyển công tác / chuyển ngạch) đã được gỡ khỏi ghép tự động
        expect(['chuyển công tác', 'chuyển ngạch'].some((s) => e.tenBieuMau.toLowerCase().includes(s))).toBe(false)
      }
    }
    const pairs = all.filter((e) => e.maLoaiDon)
    expect(pairs.length).toBe(7)
  })
})
