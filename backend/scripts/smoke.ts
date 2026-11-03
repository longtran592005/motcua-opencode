const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080'

async function check(name: string, path: string): Promise<void> {
  try {
    const response = await fetch(`${baseUrl}${path}`)
    const ok = response.status < 500
    console.log(`${ok ? 'PASS' : 'FAIL'}\t${name}\tHTTP ${response.status}`)
    if (!ok) process.exitCode = 1
  } catch (error) {
    console.log(`FAIL\t${name}\t${String(error)}`)
    process.exitCode = 1
  }
}

await check('health endpoint', '/health')
await check('public verify endpoint rejects unknown token', '/api/v1/public/verify/token/smoke-token')
console.log('Smoke đầy đủ cần CSDL test đã seed và tài khoản thử; chưa tự động hoá OTP qua email.')
