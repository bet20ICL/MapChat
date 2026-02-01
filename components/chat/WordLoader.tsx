'use client'

import { useState, useEffect } from 'react'

const WORDS = ['cooking', 'mapping', 'searching']

export function WordLoader() {
    const [index, setIndex] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % WORDS.length)
        }, 800) // 800ms per word

        return () => clearInterval(interval)
    }, [])

    return (
        <span className="text-sm font-medium animate-pulse">
            {WORDS[index]}...
        </span>
    )
}
