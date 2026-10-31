import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import type { UserSettings } from '../types/settings'
import { DEFAULT_SETTINGS } from '../types/settings'
import { fetchRemotePreferences, saveRemotePreferences } from '../services/backendApi'

const SETTINGS_STORAGE_KEY = 'gazemouse_user_settings_v1'

interface SettingsContextValue {
  settings: UserSettings
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void
  resetSettings: () => void
  exportSettings: () => string
  importSettings: (jsonString: string) => boolean
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined)

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch (e) {
      console.warn('Could not read settings from localStorage, using safe defaults:', e)
    }
    return DEFAULT_SETTINGS
  })

  // Timestamp of the latest local modification to prevent stale backend responses
  const lastLocalUpdateRef = useRef<number>(0)

  // 1. Fetch remote preferences from backend on mount (non-blocking)
  useEffect(() => {
    let isMounted = true
    const fetchStartTime = Date.now()

    fetchRemotePreferences().then((remoteSettings) => {
      if (!isMounted || !remoteSettings) return
      // Prevent stale response from overwriting newer local user changes
      if (lastLocalUpdateRef.current > fetchStartTime) return

      setSettings(remoteSettings)
      saveToStorage(remoteSettings)
    })

    return () => {
      isMounted = false
    }
  }, [])

  // 2. Apply theme & reduced motion attributes to the root DOM document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
    document.documentElement.setAttribute('data-reduced-motion', settings.reducedMotion ? 'true' : 'false')
  }, [settings.theme, settings.reducedMotion])

  // Persist settings to localStorage on change
  const saveToStorage = (newSettings: UserSettings) => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings))
    } catch (e) {
      console.error('Failed to save settings to localStorage:', e)
    }
  }

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    lastLocalUpdateRef.current = Date.now()
    setSettings((prev) => {
      const updated = { ...prev, [key]: value }
      saveToStorage(updated)
      saveRemotePreferences(updated)
      return updated
    })
  }

  const resetSettings = () => {
    lastLocalUpdateRef.current = Date.now()
    setSettings(DEFAULT_SETTINGS)
    saveToStorage(DEFAULT_SETTINGS)
    saveRemotePreferences(DEFAULT_SETTINGS)
  }

  const exportSettings = (): string => {
    return JSON.stringify(settings, null, 2)
  }

  const importSettings = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString)
      const merged: UserSettings = {
        sensitivity: typeof parsed.sensitivity === 'number' ? parsed.sensitivity : DEFAULT_SETTINGS.sensitivity,
        smoothing: typeof parsed.smoothing === 'number' ? parsed.smoothing : DEFAULT_SETTINGS.smoothing,
        deadZone: typeof parsed.deadZone === 'number' ? parsed.deadZone : DEFAULT_SETTINGS.deadZone,
        dwellDuration: typeof parsed.dwellDuration === 'number' ? parsed.dwellDuration : DEFAULT_SETTINGS.dwellDuration,
        verticalGestures: Boolean(parsed.verticalGestures),
        soundEnabled: Boolean(parsed.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled),
        theme: parsed.theme === 'dark' ? 'dark' : 'light',
        reducedMotion: Boolean(parsed.reducedMotion),
        highContrast: Boolean(parsed.highContrast),
      }
      lastLocalUpdateRef.current = Date.now()
      setSettings(merged)
      saveToStorage(merged)
      saveRemotePreferences(merged)
      return true
    } catch (e) {
      console.error('Invalid settings JSON format:', e)
      return false
    }
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        resetSettings,
        exportSettings,
        importSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
