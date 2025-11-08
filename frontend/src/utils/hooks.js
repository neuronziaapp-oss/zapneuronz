// Hook personalizado para localStorage
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(`Erro ao ler localStorage para a chave "${key}":`, error)
      return initialValue
    }
  })

  const setValue = value => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(
        `Erro ao salvar no localStorage para a chave "${key}":`,
        error
      )
    }
  }

  const removeValue = () => {
    try {
      window.localStorage.removeItem(key)
      setStoredValue(initialValue)
    } catch (error) {
      console.error(
        `Erro ao remover do localStorage para a chave "${key}":`,
        error
      )
    }
  }

  return [storedValue, setValue, removeValue]
}

// Hook para debounce
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Hook para detectar clique fora do elemento
export const useOutsideClick = (ref, callback) => {
  useEffect(() => {
    const handleClick = event => {
      if (ref.current && !ref.current.contains(event.target)) {
        callback()
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [ref, callback])
}

// Hook para detectar teclas pressionadas
export const useKeyPress = (targetKey, callback) => {
  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === targetKey) {
        callback(event)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [targetKey, callback])
}

// Hook para detectar combinações de teclas
export const useKeyCombo = (keys, callback) => {
  useEffect(() => {
    const handleKeyDown = event => {
      const combo = keys.some(combo => {
        const parts = combo.split('+')
        return parts.every(part => {
          switch (part.toLowerCase()) {
            case 'ctrl':
              return event.ctrlKey
            case 'cmd':
              return event.metaKey
            case 'shift':
              return event.shiftKey
            case 'alt':
              return event.altKey
            default:
              return event.key.toLowerCase() === part.toLowerCase()
          }
        })
      })

      if (combo) {
        event.preventDefault()
        callback(event)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [keys, callback])
}

// Hook para scroll infinito
export const useInfiniteScroll = (callback, hasMore, threshold = 100) => {
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop <
          document.documentElement.offsetHeight - threshold ||
        isFetching ||
        !hasMore
      ) {
        return
      }
      setIsFetching(true)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isFetching, hasMore, threshold])

  useEffect(() => {
    if (!isFetching) return
    callback().then(() => {
      setIsFetching(false)
    })
  }, [isFetching, callback])

  return [isFetching, setIsFetching]
}

// Hook para status online/offline
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// Hook para arrastar e soltar arquivos
export const useDragAndDrop = onDrop => {
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(null)

  useEffect(() => {
    const element = dragRef.current
    if (!element) return

    const handleDragOver = e => {
      e.preventDefault()
      setIsDragging(true)
    }

    const handleDragLeave = e => {
      e.preventDefault()
      if (!element.contains(e.relatedTarget)) {
        setIsDragging(false)
      }
    }

    const handleDrop = e => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        onDrop(files)
      }
    }

    element.addEventListener('dragover', handleDragOver)
    element.addEventListener('dragleave', handleDragLeave)
    element.addEventListener('drop', handleDrop)

    return () => {
      element.removeEventListener('dragover', handleDragOver)
      element.removeEventListener('dragleave', handleDragLeave)
      element.removeEventListener('drop', handleDrop)
    }
  }, [onDrop])

  return { dragRef, isDragging }
}

// Hook para copiar para área de transferência
export const useClipboard = () => {
  const [isCopied, setIsCopied] = useState(false)

  const copyToClipboard = useCallback(async text => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
      return true
    } catch (error) {
      console.error('Erro ao copiar para área de transferência:', error)
      return false
    }
  }, [])

  return { copyToClipboard, isCopied }
}

// Hook para detectar dispositivo móvel
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)

    return () => {
      window.removeEventListener('resize', checkIsMobile)
    }
  }, [])

  return isMobile
}

// Hook para timeout
export const useTimeout = (callback, delay) => {
  const savedCallback = useRef()

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    function tick() {
      savedCallback.current()
    }
    if (delay !== null) {
      const id = setTimeout(tick, delay)
      return () => clearTimeout(id)
    }
  }, [delay])
}

// Hook para interval
export const useInterval = (callback, delay) => {
  const savedCallback = useRef()

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    function tick() {
      savedCallback.current()
    }
    if (delay !== null) {
      const id = setInterval(tick, delay)
      return () => clearInterval(id)
    }
  }, [delay])
}

// Hook para estado anterior
export const usePrevious = value => {
  const ref = useRef()
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}

// Hook para toggle
export const useToggle = (initialValue = false) => {
  const [value, setValue] = useState(initialValue)

  const toggle = useCallback(() => setValue(prev => !prev), [])
  const setTrue = useCallback(() => setValue(true), [])
  const setFalse = useCallback(() => setValue(false), [])

  return [value, { toggle, setTrue, setFalse }]
}

// Hook para contador
export const useCounter = (initialValue = 0, step = 1) => {
  const [count, setCount] = useState(initialValue)

  const increment = useCallback(() => setCount(prev => prev + step), [step])
  const decrement = useCallback(() => setCount(prev => prev - step), [step])
  const reset = useCallback(() => setCount(initialValue), [initialValue])
  const set = useCallback(value => setCount(value), [])

  return [count, { increment, decrement, reset, set }]
}

// Hook para array
export const useArray = (initialValue = []) => {
  const [array, setArray] = useState(initialValue)

  const push = useCallback(item => setArray(prev => [...prev, item]), [])
  const remove = useCallback(
    index => setArray(prev => prev.filter((_, i) => i !== index)),
    []
  )
  const clear = useCallback(() => setArray([]), [])
  const set = useCallback(newArray => setArray(newArray), [])
  const update = useCallback(
    (index, item) =>
      setArray(prev => prev.map((val, i) => (i === index ? item : val))),
    []
  )

  return [array, { push, remove, clear, set, update }]
}

// Adicionar importações necessárias
import { useState, useEffect, useCallback, useRef } from 'react'
