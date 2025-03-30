"use client"

import { useRef, useEffect, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

// Set Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoiZ2JoYW5zZW4iLCJhIjoiY204dmFscTV2MHNybjJqcHZjeDl4cHF2MCJ9.Xdctx_bxWdu3Q64ruVroCw"

interface MapProps {
  position: GeolocationPosition | null
  heading: number | null
  invertX: boolean
  invertY: boolean
  zoomLevel: number
}

export default function Map({ position, heading, invertX, invertY, zoomLevel }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [snappedLocation, setSnappedLocation] = useState<[number, number] | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastPositionRef = useRef<[number, number] | null>(null)
  const positionUpdateTimeRef = useRef<number | null>(null)

  // Initialize map
  useEffect(() => {
    if (mapContainer.current && !map.current) {
      try {
        // Use a simpler map style - navigation-night-v1 is already dark with emphasis on roads
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/navigation-night-v1",
          center: [-74.5, 40], // Default center (will be updated with user's location)
          zoom: zoomLevel, // Use the zoom level from props
          pitch: 75, // High pitch to look forward instead of down
          attributionControl: false,
          logoPosition: "bottom-right",
          pitchWithRotate: true, // Enable pitch with rotate for the forward-looking view
          dragRotate: false, // Disable drag rotate to avoid unexpected rotations
          dragPan: false, // Disable panning to prevent manual movement
          scrollZoom: false, // Disable scroll zoom to prevent manual zooming
          doubleClickZoom: false, // Disable double click zoom
          touchZoomRotate: false, // Disable touch zoom and rotate
          keyboard: false, // Disable keyboard navigation
        })

        map.current.on("load", () => {
          setMapLoaded(true)

          // Apply minimal customizations to the map style
          if (map.current) {
            try {
              // Make the map background completely black
              if (map.current.getLayer("background")) {
                map.current.setPaintProperty("background", "background-color", "#000000")
              }

              // Hide non-essential layers to create a minimal HUD display
              const nonEssentialLayers = [
                "admin-1-boundary",
                "admin-0-boundary",
                "admin-0-boundary-disputed",
                "admin-1-boundary-bg",
                "admin-0-boundary-bg",
                "poi-label",
                "airport-label",
                "settlement-subdivision-label",
                "settlement-label",
                "state-label",
                "country-label",
                "natural-point-label",
                "natural-line-label",
                "waterway-label",
                "water-point-label",
                "water-line-label",
                "water-polygon",
                "waterway",
                "water-shadow",
                "land",
                "landuse",
                "hillshade",
                "contour",
                "building",
              ]

              // Only hide layers that actually exist
              nonEssentialLayers.forEach((layerId) => {
                if (map.current?.getLayer(layerId)) {
                  map.current.setLayoutProperty(layerId, "visibility", "none")
                }
              })

              // Add a custom layer for the user location dot
              if (!map.current.getSource("user-location")) {
                map.current.addSource("user-location", {
                  type: "geojson",
                  data: {
                    type: "Feature",
                    geometry: {
                      type: "Point",
                      coordinates: [-74.5, 40], // Will be updated with actual position
                    },
                    properties: {},
                  },
                })
              }

              // Add a circle layer for the user location with size relative to zoom
              if (!map.current.getLayer("user-location-dot")) {
                map.current.addLayer({
                  id: "user-location-dot",
                  type: "circle",
                  source: "user-location",
                  paint: {
                    // Size relative to zoom level: smaller at low zoom, larger at high zoom
                    "circle-radius": [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      16,
                      12, // At zoom level 16, radius is 12px (increased from 8)
                      24,
                      24, // At zoom level 24, radius is 24px (increased from 16)
                    ],
                    "circle-color": "#1E88E5",
                    "circle-stroke-width": [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      16,
                      3, // At zoom level 16, stroke is 3px (increased from 2)
                      24,
                      6, // At zoom level 24, stroke is 6px (increased from 4)
                    ],
                    "circle-stroke-color": "#ffffff",
                    "circle-pitch-alignment": "map", // This makes the circle flat on the map
                  },
                })

                // Add a larger circle for the pulse effect - FIXED to avoid nested zoom expressions
                map.current.addLayer({
                  id: "user-location-pulse",
                  type: "circle",
                  source: "user-location",
                  paint: {
                    // Use a simpler expression that doesn't nest zoom interpolations
                    "circle-radius": [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      16,
                      ["*", ["get", "pulseSize"], 15], // At zoom 16, base size * 15 (increased from 10)
                      24,
                      ["*", ["get", "pulseSize"], 30], // At zoom 24, base size * 30 (increased from 20)
                    ],
                    "circle-color": "#1E88E5",
                    "circle-opacity": ["get", "pulseOpacity"],
                    "circle-pitch-alignment": "map", // This makes the circle flat on the map
                  },
                })
              }
            } catch (styleError) {
              console.error("Error customizing map style:", styleError)
              // Don't set error state here, as the map is still usable
            }
          }
        })

        map.current.on("error", (e) => {
          console.error("Mapbox error:", e.error)
          setMapError("Error loading map. Please refresh the page.")
        })
      } catch (mapError) {
        console.error("Error initializing map:", mapError)
        setMapError("Failed to initialize map. Please check your connection and try again.")
      }
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [zoomLevel])

  // Function to snap to nearest road
  const snapToRoad = async (longitude: number, latitude: number): Promise<[number, number]> => {
    try {
      // Use Mapbox Map Matching API to snap to road
      const radius = 50 // Search radius in meters
      const url = `https://api.mapbox.com/matching/v5/mapbox/driving/${longitude},${latitude}?approaches=curb&radiuses=${radius}&steps=true&access_token=${mapboxgl.accessToken}`

      const response = await fetch(url)
      const data = await response.json()

      // Check if we got a valid match
      if (data.matchings && data.matchings.length > 0 && data.matchings[0].geometry) {
        // Get the first point of the matched route
        const coordinates = data.matchings[0].geometry.coordinates
        if (coordinates && coordinates.length > 0) {
          return coordinates[0] as [number, number]
        }
      }

      // If no match found, return original coordinates
      return [longitude, latitude]
    } catch (error) {
      console.error("Error snapping to road:", error)
      // Return original coordinates on error
      return [longitude, latitude]
    }
  }

  // Function to smoothly interpolate between positions
  const interpolatePosition = (start: [number, number], end: [number, number], progress: number): [number, number] => {
    return [start[0] + (end[0] - start[0]) * progress, start[1] + (end[1] - start[1]) * progress]
  }

  // Update map when position changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !position) return

    const { longitude, latitude } = position.coords
    const currentTime = Date.now()

    // Try to snap to road and update with smooth transition
    const snapAndUpdate = async () => {
      let targetLngLat: [number, number] = [longitude, latitude]

      try {
        // Snap to nearest road
        targetLngLat = await snapToRoad(longitude, latitude)
        setSnappedLocation(targetLngLat)
      } catch (error) {
        console.error("Error in road snapping:", error)
        // Use original coordinates if snapping fails
        targetLngLat = [longitude, latitude]
      }

      // If this is the first position update, just set it directly
      if (!lastPositionRef.current) {
        lastPositionRef.current = targetLngLat
        positionUpdateTimeRef.current = currentTime

        // Update map center - position it so we're at the bottom third of the viewport
        if (map.current) {
          // Calculate a point that's slightly ahead of our position based on heading
          const headingRad = heading ? (heading * Math.PI) / 180 : 0
          // Reduced offset distance to be closer to the user location
          const offsetDistance = 0.00015 // Roughly 15 meters at most latitudes (reduced from 30m)
          const offsetLng = targetLngLat[0] + Math.sin(headingRad) * offsetDistance
          const offsetLat = targetLngLat[1] + Math.cos(headingRad) * offsetDistance

          map.current.flyTo({
            center: [offsetLng, offsetLat],
            zoom: zoomLevel,
            pitch: 75,
            essential: true,
            duration: 0,
          })
        }
      } else {
        // For subsequent updates, animate smoothly
        const lastUpdateTime = positionUpdateTimeRef.current || currentTime
        const timeDiff = currentTime - lastUpdateTime

        // Update the reference values
        positionUpdateTimeRef.current = currentTime

        // Start a smooth animation from last position to new position
        const startPosition = lastPositionRef.current
        const animationDuration = 1000 // 1 second animation
        const startTime = Date.now()

        const animatePosition = () => {
          const now = Date.now()
          const elapsed = now - startTime
          const progress = Math.min(elapsed / animationDuration, 1)

          // Calculate interpolated position
          const currentPosition = interpolatePosition(startPosition, targetLngLat, progress)

          if (map.current) {
            // Update the map center - position it so we're at the bottom third of the viewport
            const headingRad = heading ? (heading * Math.PI) / 180 : 0
            // Reduced offset distance to be closer to the user location
            const offsetDistance = 0.00015 // Roughly 15 meters at most latitudes (reduced from 30m)
            const offsetLng = currentPosition[0] + Math.sin(headingRad) * offsetDistance
            const offsetLat = currentPosition[1] + Math.cos(headingRad) * offsetDistance

            map.current.setCenter([offsetLng, offsetLat])

            // Calculate pulse values
            const pulseProgress = (now % 2000) / 2000 // 0 to 1 over 2 seconds
            const pulseSize = 1 + pulseProgress // Size grows from 1x to 2x
            const pulseOpacity = Math.max(0, 0.4 - pulseProgress * 0.4) // Opacity fades from 0.4 to 0

            // Update the user location source
            const source = map.current.getSource("user-location")
            if (source && "setData" in source) {
              source.setData({
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: currentPosition,
                },
                properties: {
                  pulseSize: pulseSize,
                  pulseOpacity: pulseOpacity,
                },
              })
            }
          }

          // Continue animation if not complete
          if (progress < 1) {
            animationFrameRef.current = requestAnimationFrame(animatePosition)
          } else {
            // Animation complete, update last position
            lastPositionRef.current = targetLngLat
          }
        }

        // Start the animation
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        animationFrameRef.current = requestAnimationFrame(animatePosition)
      }
    }

    snapAndUpdate()
  }, [position, mapLoaded, zoomLevel, heading])

  // Update map bearing when heading changes
  useEffect(() => {
    if (!map.current || !mapLoaded || heading === null) return

    try {
      // Ensure heading is a valid number
      const bearingValue = Number(heading)

      if (!isNaN(bearingValue)) {
        // Use easeTo instead of flyTo for bearing changes (smoother)
        map.current.easeTo({
          bearing: bearingValue,
          duration: 300,
          essential: true,
        })
      }
    } catch (error) {
      console.error("Error setting map bearing:", error)
    }
  }, [heading, mapLoaded])

  // Apply axis inversion
  useEffect(() => {
    if (!mapContainer.current) return

    const transform = []
    if (invertX) transform.push("scaleX(-1)")
    if (invertY) transform.push("scaleY(-1)")

    mapContainer.current.style.transform = transform.join(" ")
  }, [invertX, invertY])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full transition-transform duration-300" />

      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
            <p>Loading map...</p>
          </div>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-red-500 text-center p-4 max-w-md">
            <p className="text-xl mb-2">Map Error</p>
            <p>{mapError}</p>
          </div>
        </div>
      )}

      {/* Updated Heading Indicator - moved to bottom and made transparent */}
      {heading !== null && <HeadingIndicator heading={heading} />}
    </div>
  )
}

// Updated Heading Indicator Component - moved to bottom and made transparent
function HeadingIndicator({ heading }: { heading: number }) {
  // Use window.innerWidth for the initial calculation, but don't cause re-renders
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1000)

  useEffect(() => {
    // Update window width on resize
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div className="absolute bottom-0 left-0 right-0 flex justify-center pointer-events-none">
      <div className="relative w-full h-16 overflow-hidden bg-transparent">
        {/* Stronger gradient fades on edges */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black to-transparent z-10"></div>
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black to-transparent z-10"></div>

        {/* Heading strip */}
        <div
          className="absolute inset-0 flex items-center"
          style={{
            transform: `translateX(${-heading * 4 + windowWidth / 2}px)`,
            transition: "transform 0.3s ease-out",
          }}
        >
          {/* Generate degree markers */}
          {Array.from({ length: 360 }).map((_, i) => {
            // Calculate the actual degree value
            const degree = i

            // Determine cardinal direction
            let cardinalText = ""
            if (degree === 0) cardinalText = "N"
            else if (degree === 90) cardinalText = "E"
            else if (degree === 180) cardinalText = "S"
            else if (degree === 270) cardinalText = "W"
            else if (degree === 45) cardinalText = "NE"
            else if (degree === 135) cardinalText = "SE"
            else if (degree === 225) cardinalText = "SW"
            else if (degree === 315) cardinalText = "NW"

            return (
              <div
                key={i}
                className="absolute flex flex-col items-center justify-center"
                style={{
                  left: `${i * 4}px`,
                  height: "100%",
                  opacity: cardinalText ? 1 : degree % 20 === 0 ? 0.8 : 0.4,
                }}
              >
                {/* Tick mark */}
                <div
                  className="w-px bg-white"
                  style={{
                    height: cardinalText ? "12px" : degree % 20 === 0 ? "8px" : "4px",
                    opacity: cardinalText ? 1 : degree % 20 === 0 ? 0.8 : 0.4,
                  }}
                ></div>

                {/* Degree text */}
                {degree % 20 === 0 && (
                  <span className="text-xs text-white mt-1 font-light" style={{ opacity: 0.8 }}>
                    {degree}
                  </span>
                )}

                {/* Cardinal direction */}
                {cardinalText && <span className="text-base text-white mt-1 font-medium">{cardinalText}</span>}
              </div>
            )
          })}
        </div>

        {/* Center indicator */}
        <div className="absolute top-0 left-1/2 h-full flex flex-col items-center justify-start z-20">
          <div className="w-px h-12 bg-white"></div>
          <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-white"></div>
        </div>
      </div>
    </div>
  )
}

