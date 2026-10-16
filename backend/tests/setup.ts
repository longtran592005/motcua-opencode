// Đặt trước khi `src/config/env.ts` được nạp: dotenv KHÔNG ghi đè biến đã có,
// nên NODE_ENV=test ở đây sẽ thắng giá trị trong tệp .env.
process.env.NODE_ENV = 'test'
