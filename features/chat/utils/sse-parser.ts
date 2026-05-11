/**
 * SSE 消息解析器
 *
 * 职责：
 * 1. 解析 SSE 流
 * 2. 区分 thinking / answer / tool_calls
 * 3. 返回标准化的数据
 */

import type { SSEData } from '@/features/chat/types/chat'
import { parseSSELine, splitSSEBuffer } from '@/lib/utils/sse'

export interface SSECallbacks {
  onData: (data: SSEData) => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

export class SSEParser {
  /**
   * 解析单行 SSE 数据
   */
  static parseLine(line: string): SSEData | null {
    // 检查这行数据是不是 data: [DONE]，如果是告诉前端输出完毕
    if (line.startsWith('data: ') && line.slice(6).trim() === '[DONE]') {
      return { type: 'complete' }
    }

    const data = parseSSELine(line)
    if (!data) return null

    try {
      return JSON.parse(data) as SSEData
    } catch (error) {
      console.error('[SSEParser] Failed to parse SSE data:', data, error)
      return null
    }
  }

  /**
   * 处理 SSE 流，使用回调函数
   * @param reader 可读流
   * @param callbacks 回调函数：当有数据时，调用 onData 回调函数；当流结束时，调用 onComplete 回调函数；当有错误时，调用 onError 回调函数 
   */
  static async parseStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    callbacks: SSECallbacks
  ): Promise<void> {
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        // 对应后端的 controller.close()
        if (done) {
          if (buffer.trim()) {
            const { lines } = splitSSEBuffer(buffer + '\n')
            for (const line of lines) {
              const parsed = SSEParser.parseLine(line)
              if (parsed) callbacks.onData(parsed)
            }
          }
          callbacks.onComplete?.()
          return
        }
        // 使用流式解码
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        const { lines, remaining } = splitSSEBuffer(buffer)
        buffer = remaining

        for (const line of lines) {
          const parsed = SSEParser.parseLine(line)
          if (parsed) callbacks.onData(parsed)
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        callbacks.onComplete?.()
        return
      }
      callbacks.onError?.(error as Error)
      throw error
    }
  }
}
