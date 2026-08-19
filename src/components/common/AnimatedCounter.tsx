import React, { useState, useEffect } from 'react'

interface AnimatedCounterProps {
  value: number
  duration?: number
  formatter?: (val: number) => string
  className?: string
}

export function AnimatedCounter({
  value,
  duration = 800,
  formatter = (v) => v.toLocaleString('pt-BR'),
  className = '',
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let startTimestamp: number | null = null
    const startValue = displayValue
    const diff = value - startValue

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      const easeProgress = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      setDisplayValue(startValue + diff * easeProgress)
      if (progress < 1) {
        window.requestAnimationFrame(step)
      } else {
        setDisplayValue(value)
      }
    }

    const animId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(animId)
  }, [value, duration])

  return <span className={className}>{formatter(displayValue)}</span>
}
