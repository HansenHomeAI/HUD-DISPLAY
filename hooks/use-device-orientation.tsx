"use client"

import { useState, useEffect } from "react"

interface DeviceOrientationState {
  orientation: DeviceOrientationEvent | null
  heading: number | null
  error: string | null
}

export function useDeviceOrientation() {
  const [state, setState] = useState<DeviceOrientationState>({
    orientation: null,
    heading: null,
    error: null,
  })

  useEffect(() => {
    // Check if DeviceOrientationEvent is available
    if (!window.DeviceOrientationEvent) {
      setState((prev) => ({
        ...prev,
        error: "Device orientation is not supported by this browser.",
      }))
      return
    }

    // For iOS 13+ devices that require permission
    const requestPermission = async () => {
      if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
        try {
          const permissionState = await (DeviceOrientationEvent as any).requestPermission()
          if (permissionState !== "granted") {
            setState((prev) => ({
              ...prev,
              error: "Permission to access device orientation was denied.",
            }))
          }
        } catch (error) {
          setState((prev) => ({
            ...prev,
            error: "Error requesting device orientation permission.",
          }))
        }
      }
    }

    // Try to request permission on iOS
    requestPermission()

    // Handle orientation changes
    const handleOrientation = (event: DeviceOrientationEvent) => {
      // Calculate heading from alpha, beta, gamma
      let heading = null

      // Only calculate heading if we have valid orientation data
      if (event.alpha !== null && typeof event.alpha === "number") {
        // Normalize alpha to 0-360 degrees
        heading = 360 - event.alpha // Convert to clockwise rotation
      }

      setState({
        orientation: event,
        heading,
        error: null,
      })
    }

    window.addEventListener("deviceorientation", handleOrientation)

    // Cleanup
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation)
    }
  }, [])

  return state
}

