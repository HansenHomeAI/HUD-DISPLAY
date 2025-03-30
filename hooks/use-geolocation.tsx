"use client"

import { useState, useEffect } from "react"

interface GeolocationState {
  position: GeolocationPosition | null
  heading: number | null
  error: GeolocationPositionError | null
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    heading: null,
    error: null,
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: {
          code: 0,
          message: "Geolocation is not supported by this browser.",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError,
      }))
      return
    }

    let lastLat: number | null = null
    let lastLng: number | null = null

    // Watch position with high accuracy
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords
        let calculatedHeading = heading || null

        // If device provides heading directly, use it
        // Otherwise, calculate heading from position changes if we have previous coordinates
        if (calculatedHeading === null && lastLat !== null && lastLng !== null) {
          // Only calculate if we've moved enough to get a meaningful direction
          const distance = getDistance(lastLat, lastLng, latitude, longitude)
          if (distance > 5) {
            // Only calculate heading if moved more than 5 meters
            calculatedHeading = getBearing(lastLat, lastLng, latitude, longitude)
          }
        }

        // Update last known position
        lastLat = latitude
        lastLng = longitude

        setState({
          position,
          heading: calculatedHeading,
          error: null,
        })
      },
      (error) => {
        setState((prev) => ({
          ...prev,
          error,
        }))
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      },
    )

    // Cleanup
    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  // Helper function to calculate distance between coordinates (Haversine formula)
  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3 // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  // Helper function to calculate bearing between coordinates
  function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const λ1 = (lon1 * Math.PI) / 180
    const λ2 = (lon2 * Math.PI) / 180

    const y = Math.sin(λ2 - λ1) * Math.cos(φ2)
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)
    const θ = Math.atan2(y, x)

    return ((θ * 180) / Math.PI + 360) % 360 // in degrees, clockwise from north
  }

  return state
}

