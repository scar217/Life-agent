'use client'

/**
 * Landing Input Component - 落地页输入区域（CSR）
 * 
 * Client Component - 处理用户交互
 * - 消息输入
 * - 发送按钮
 * - 登录对话框触发
 * 
 * @module components/LandingPage/LandingInput
 */

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoginDialog } from '@/features/auth/components/LoginDialog'

/**
 * 输入区域组件（Client Component）
 * 
 * 处理所有交互逻辑，保持简洁风格
 */
export function LandingInput() {
  const router = useRouter()
  const [message, setMessage] = useState('') // 保存用户输入的消息
  const [showLogin, setShowLogin] = useState(false) // 控制登录对话框是否显示
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login') // 控制登录对话框的登录模式
  const pendingMessageRef = useRef('') // 保存用户输入的消息，登录成功后用

  /**
   * 处理发送按钮点击
   */
  const handleSend = useCallback(() => {
    const trimmedMessage = message.trim()

    if (!trimmedMessage) return

    // 保存到 ref，登录成功后用
    pendingMessageRef.current = trimmedMessage
    setAuthMode('login')
    setShowLogin(true)
  }, [message])

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // 如果按下回车键且没有Shift键，则阻止默认行为并调用发送函数
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend() // 调用发送函数
      }
    },
    [handleSend]
  )

  return (
    <>
      {/* 输入区域 */}
      <div className="relative">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息开始对话..."
          autoFocus
          className="w-full px-6 py-4 pr-14 text-base rounded-2xl border-2 border-border bg-background focus:outline-none focus:border-primary transition-colors"
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim()}
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>

      {/* 提示文字与快捷入口 */}
      <div className="mt-6 space-y-2">
        {/* <p className="text-center text-sm text-muted-foreground">
          登录或注册账号，才能使用AI聊天
        </p> */}
        <p className="text-center text-sm text-muted-foreground">
          您需要
          <button
            type="button"
            onClick={() => {
              setAuthMode('login')
              setShowLogin(true)
            }}
            className="mx-1 text-primary hover:underline"
          >
            登录
          </button>
          或
          <button
            type="button"
            onClick={() => {
              setAuthMode('register')
              setShowLogin(true)
            }}
            className="mx-1 text-primary hover:underline"
          >
            注册
          </button>
          后来才能使用AI聊天功能
        </p>
      </div>

      {/* 登录对话框 */}
      <LoginDialog
        open={showLogin}
        onOpenChange={setShowLogin}
        initialRegisterMode={authMode === 'register'}
        onSuccess={() => {
          setShowLogin(false)
          // 带上 pending message 跳转
          const msg = encodeURIComponent(pendingMessageRef.current)
          router.push(`/chat?msg=${msg}`)
        }}
      />
    </>
  )
}

