"use client"

import { forwardRef, useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Minus, Plus, Maximize, Minimize } from "lucide-react"

interface ControlsProps {
  invertX: boolean
  invertY: boolean
  setInvertX: (value: boolean) => void
  setInvertY: (value: boolean) => void
  zoomLevel: number
  setZoomLevel: (value: number) => void
}

const Controls = forwardRef<HTMLDivElement, ControlsProps>(
  ({ invertX, invertY, setInvertX, setInvertY, zoomLevel, setZoomLevel }, ref) => {
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Handle zoom level changes
    const handleZoomChange = (value: number[]) => {
      setZoomLevel(value[0])
    }

    const increaseZoom = () => {
      setZoomLevel(Math.min(24, zoomLevel + 0.5))
    }

    const decreaseZoom = () => {
      setZoomLevel(Math.max(16, zoomLevel - 0.5))
    }

    // Toggle fullscreen
    const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement
          .requestFullscreen()
          .then(() => {
            setIsFullscreen(true)
          })
          .catch((err) => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`)
          })
      } else {
        if (document.exitFullscreen) {
          document
            .exitFullscreen()
            .then(() => {
              setIsFullscreen(false)
            })
            .catch((err) => {
              console.error(`Error attempting to exit fullscreen: ${err.message}`)
            })
        }
      }
    }

    // Update fullscreen state when it changes outside of our control
    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement)
      }

      document.addEventListener("fullscreenchange", handleFullscreenChange)

      return () => {
        document.removeEventListener("fullscreenchange", handleFullscreenChange)
      }
    }, [])

    return (
      <div
        ref={ref}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md p-4 rounded-xl flex flex-col items-center gap-4 z-10 border border-gray-700"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <label htmlFor="invert-x" className="text-sm font-medium">
              Invert X-Axis
            </label>
            <Switch id="invert-x" checked={invertX} onCheckedChange={setInvertX} />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="invert-y" className="text-sm font-medium">
              Invert Y-Axis
            </label>
            <Switch id="invert-y" checked={invertY} onCheckedChange={setInvertY} />
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors flex items-center justify-center"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>

        <div className="w-full flex items-center gap-2">
          <button onClick={decreaseZoom} className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors">
            <Minus className="h-4 w-4" />
          </button>

          <Slider
            value={[zoomLevel]}
            min={16}
            max={24}
            step={0.5}
            onValueChange={handleZoomChange}
            className="flex-1"
          />

          <button onClick={increaseZoom} className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors">
            <Plus className="h-4 w-4" />
          </button>

          <span className="text-xs w-8 text-center">{zoomLevel.toFixed(1)}</span>
        </div>
      </div>
    )
  },
)

Controls.displayName = "Controls"

export default Controls

