import { useState, useEffect, useRef, useCallback } from 'react'

export interface UseSpeechRecognitionOptions {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
  onResult?: (transcript: string) => void
  onError?: (error: string) => void
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean
  isSupported: boolean
  transcript: string
  startListening: () => void
  stopListening: () => void
  toggleListening: () => void
  resetTranscript: () => void
  errorMessage: string | null
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const { lang = 'pt-BR', continuous = true, interimResults = true, onResult, onError } = options

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Verifica suporte no browser: window.SpeechRecognition ou window.webkitSpeechRecognition
  const isSupported =
    typeof window !== 'undefined' &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  const recognitionRef = useRef<any>(null)

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        /* intentionally ignored */
      }
    }
    setIsListening(false)
  }, [])

  const startListening = useCallback(() => {
    setErrorMessage(null)
    if (!isSupported) {
      const msg = 'Seu navegador não suporta reconhecimento de voz — use Chrome ou Edge.'
      setErrorMessage(msg)
      onError?.(msg)
      return
    }

    try {
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognitionClass()
      recognitionRef.current = recognition

      recognition.lang = lang
      recognition.continuous = continuous
      recognition.interimResults = interimResults

      recognition.onstart = () => {
        setIsListening(true)
        setErrorMessage(null)
      }

      recognition.onresult = (event: any) => {
        let fullTranscript = ''
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript
        }
        setTranscript(fullTranscript)
        onResult?.(fullTranscript)
      }

      recognition.onerror = (event: any) => {
        let msg = 'Erro no reconhecimento de voz.'
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          msg = 'Permissão para usar o microfone negada. Verifique as configurações do navegador.'
        } else if (event.error === 'no-speech') {
          // Sem fala detectada, apenas pare suavemente
          return
        } else if (event.error === 'network') {
          msg = 'Erro de rede na transcrição de voz.'
        }
        setErrorMessage(msg)
        onError?.(msg)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
    } catch (e: any) {
      const msg = e?.message || 'Falha ao iniciar o microfone.'
      setErrorMessage(msg)
      onError?.(msg)
      setIsListening(false)
    }
  }, [isSupported, lang, continuous, interimResults, onResult, onError])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  const resetTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          /* intentionally ignored */
        }
      }
    }
  }, [])

  return {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    errorMessage,
  }
}
