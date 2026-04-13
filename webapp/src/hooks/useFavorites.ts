import { useState, useCallback } from 'react'

const STORAGE_KEY = 'mie-favorites'

function loadFromStorage(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set(parsed as number[])
  } catch {
    // ignore malformed data
  }
  return new Set()
}

function saveToStorage(favorites: Set<number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]))
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<number>>(() => loadFromStorage())

  const toggleFavorite = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveToStorage(next)
      return next
    })
  }, [])

  const isFavorite = useCallback((id: number) => favorites.has(id), [favorites])

  return { favorites, isFavorite, toggleFavorite }
}
