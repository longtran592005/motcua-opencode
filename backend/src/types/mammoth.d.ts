declare module 'mammoth' {
  export interface RawTextResult {
    value: string
    messages: unknown[]
  }
  export function extractRawText(input: { buffer: Buffer } | { path: string }): Promise<RawTextResult>
}

