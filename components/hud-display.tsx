"use client"

import type React from "react"

import { useState, useRef } from "react"
import Map from "@/components/map"
import Controls from "@/components/controls"
import { useGeolocation } from "@/hooks/use-geolocation"
import { useDeviceOrientation } from "@/hooks/use-device-orientation"

export default function HudDisplay() {
  const [invertX, setInvertX] = useState(false)
  const [invertY, setInvertY] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(21) // Set default zoom to 21
  const [showControls, setShowControls] = useState(false) // Controls hidden by default
  const controlsRef = useRef<HTMLDivElement>(null)
  const { position, heading: geoHeading, error: geoError } = useGeolocation()
  const { heading: orientationHeading, error: orientationError } = useDeviceOrientation()

  // Use orientation heading if available, otherwise fall back to geolocation heading
  const heading = orientationHeading !== null ? orientationHeading : geoHeading

  // Handle screen tap to show controls
  const handleScreenTap = (e: React.MouseEvent) => {
    // If controls are not shown, show them
    if (!showControls) {
      setShowControls(true)
      return
    }

    // If controls are shown and tap is outside controls, hide them
    if (controlsRef.current && !controlsRef.current.contains(e.target as Node)) {
      setShowControls(false)
    }
  }

  // Format error messages for display
  const formatErrorMessage = (error: GeolocationPositionError | string | null) => {
    if (!error) return null

    if (typeof error === "string") {
      return error
    }

    // Handle GeolocationPositionError
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "Location access denied. Please enable location services for this app."
      case error.POSITION_UNAVAILABLE:
        return "Location information is unavailable. Please check your device settings."
      case error.TIMEOUT:
        return "Location request timed out. Please try again."
      default:
        return error.message || "Unknown location error"
    }
  }

  const geoErrorMessage = formatErrorMessage(geoError)
  const orientationErrorMessage = formatErrorMessage(orientationError)

  return (
    <div className="relative w-full h-full" onClick={handleScreenTap}>
      <Map position={position} heading={heading} invertX={invertX} invertY={invertY} zoomLevel={zoomLevel} />

      {showControls && (
        <Controls
          ref={controlsRef}
          invertX={invertX}
          invertY={invertY}
          setInvertX={setInvertX}
          setInvertY={setInvertY}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
        />
      )}

      {(geoErrorMessage || orientationErrorMessage) && (
        <div className="absolute bottom-24 left-4 right-4 bg-red-500/80 text-white p-4 rounded-lg">
          {geoErrorMessage && <p className="mb-2">{geoErrorMessage}</p>}
          {orientationErrorMessage && <p>{orientationErrorMessage}</p>}
        </div>
      )}
    </div>
  )
}

