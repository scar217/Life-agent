'use client'

/**
 * OAuth Popup Hook - 弹窗 OAuth 登录
 * 
 * 双重检测机制：
 * 1. postMessage - 弹窗主动通知（快速）
 * 2. session 轮询 - 兜底方案（可靠）
 */

import { useCallback, useRef, useState } from 'react'
import { getSession } from 'next-auth/react'

interface UseOAuthPopupOptions {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function useOAuthPopup(options: UseOAuthPopupOptions = {}) {
  const { onSuccess, onError } = options
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const popupRef = useRef<Window | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messageHandlerRef = useRef<((e: MessageEvent) => void) | null>(null)
  const successCalledRef = useRef(false)
  const isPollingRef = useRef(false)

  // 清理函数，用于清理弹窗和轮询
  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (messageHandlerRef.current) {
      window.removeEventListener('message', messageHandlerRef.current)
      messageHandlerRef.current = null
    }
    isPollingRef.current = false
    setIsLoading(null)
  }, [])

  // 处理成功函数，用于处理成功登录
  const handleSuccess = useCallback(() => {
    if (successCalledRef.current) return
    successCalledRef.current = true
    cleanup()
    onSuccess?.()
  }, [cleanup, onSuccess])

  // 打开弹窗，用于进行 OAuth 登录
  const openPopup = useCallback((provider: 'google' | 'github') => {
    setIsLoading(provider)
    successCalledRef.current = false

    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const url = `/auth/popup/${provider}`

    // 打开弹窗，用于进行 OAuth 登录，并获取弹窗的对象
    popupRef.current = window.open(
      url,
      'oauth-popup',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    )

    // 如果弹窗没有被打开
    if (!popupRef.current) {
      cleanup()
      onError?.('弹窗被阻止，请允许弹窗')
      return
    }

    // 方式1: 监听 postMessage（快速响应）
    // 定义事件处理函数
    messageHandlerRef.current = (event: MessageEvent) => {
      // 如果不是同源发来的消息（防止跨域攻击）
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'oauth-success') {
        handleSuccess()
      } else if (event.data?.type === 'oauth-cancelled') {
        cleanup()
      }
    }
    // 监听弹窗的事件
    window.addEventListener('message', messageHandlerRef.current)

    // 方式2: 轮询检测弹窗关闭 + session 状态
    pollRef.current = setInterval(() => {
      // 防止并发轮询
      if (isPollingRef.current) return
      
      // 弹窗关闭时检查 session
      if (popupRef.current?.closed) {
        isPollingRef.current = true
        getSession().then(session => {
          if (session) {
            handleSuccess()
          } else {
            cleanup()
          }
        })
      }
    }, 200)
  }, [cleanup, handleSuccess, onError])

  return { openPopup, isLoading }
}
